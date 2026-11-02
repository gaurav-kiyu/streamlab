"use strict";

const test = require("node:test");
const assert = require("node:assert");
const Database = require("better-sqlite3");
const {
  resolveLiveTvSecret,
  deriveKey,
  encryptCredentials,
  decryptCredentials,
  migrateCredentialsToDedicatedKey,
  redactUrl
} = require("../src/livetv/crypto");
const livetvMigrations = require("../src/livetv/migrations");

const KEY_32_A = "streamlab_phase17_dedicated_key_alpha_32chars!";
const KEY_32_B = "streamlab_phase17_dedicated_key_bravo_32chars!!";
const JWT_FALLBACK = "streamlab_legacy_jwt_secret_32_characters_long!";

test("Crypto 1: Production Mode Requires LIVETV_ENCRYPTION_KEY (No Silent Fallback)", () => {
  const origEnv = process.env.NODE_ENV;
  const origKey = process.env.LIVETV_ENCRYPTION_KEY;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.LIVETV_ENCRYPTION_KEY;

    // Must throw FATAL_CONFIG_ERROR when LIVETV_ENCRYPTION_KEY is unset in production
    assert.throws(
      () => {
        resolveLiveTvSecret(JWT_FALLBACK);
      },
      (err) => {
        return (
          err.message.includes("FATAL_CONFIG_ERROR") &&
          err.message.includes("Falling back to JWT_SECRET is strictly prohibited in production mode")
        );
      },
      "Must forbid silent fallback to JWT_SECRET in production"
    );

    // If key is provided but shorter than 32 characters, must throw
    process.env.LIVETV_ENCRYPTION_KEY = "too_short_key";
    assert.throws(
      () => {
        resolveLiveTvSecret(JWT_FALLBACK);
      },
      (err) => {
        return err.message.includes("at least 32 characters");
      }
    );

    // If valid dedicated key is provided in production, succeeds
    process.env.LIVETV_ENCRYPTION_KEY = KEY_32_A;
    assert.strictEqual(resolveLiveTvSecret(JWT_FALLBACK), KEY_32_A);
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origKey !== undefined) {
      process.env.LIVETV_ENCRYPTION_KEY = origKey;
    } else {
      delete process.env.LIVETV_ENCRYPTION_KEY;
    }
  }
});

test("Crypto 2: Unique 12-Byte Random IV & Tampered Ciphertext Rejection", () => {
  const creds = { username: "iptv_admin", token: "super_secret_token_12345" };

  // Encrypt twice: verify IV randomness
  const enc1 = JSON.parse(encryptCredentials(creds, KEY_32_A));
  const enc2 = JSON.parse(encryptCredentials(creds, KEY_32_A));

  assert.strictEqual(enc1.v, 1);
  assert.strictEqual(enc2.v, 1);
  assert.notStrictEqual(enc1.iv, enc2.iv, "Each encryption must use a unique cryptographically random IV");
  assert.notStrictEqual(enc1.data, enc2.data, "Different IVs must yield different ciphertexts");

  // Tamper with ciphertext by flipping one hex character
  const tamperedData = enc1.data.slice(0, -1) + (enc1.data.endsWith("a") ? "b" : "a");
  const tamperedBundle = JSON.stringify({ ...enc1, data: tamperedData });

  assert.throws(
    () => {
      decryptCredentials(tamperedBundle, KEY_32_A);
    },
    (err) => {
      return err.message.includes("DECRYPTION_FAILED");
    },
    "Tampered ciphertext must be rejected by GCM authentication tag verification"
  );

  // Tamper with authentication tag
  const tamperedTag = enc1.tag.slice(0, -1) + (enc1.tag.endsWith("0") ? "1" : "0");
  const tamperedTagBundle = JSON.stringify({ ...enc1, tag: tamperedTag });

  assert.throws(
    () => {
      decryptCredentials(tamperedTagBundle, KEY_32_A);
    },
    (err) => {
      return err.message.includes("DECRYPTION_FAILED");
    },
    "Tampered authentication tag must be rejected"
  );
});

test("Crypto 3: Zero-Downtime Key Rotation via Dual Keyring", () => {
  const creds = { subscription: "premium_iptv", authCode: "secret_code_xyz" };

  // Encrypted under older Key A
  const encryptedUnderA = encryptCredentials(creds, KEY_32_A, 1);

  // Keyring has current = Key B, previous = Key A
  const keyring = {
    current: KEY_32_B,
    previous: KEY_32_A
  };

  const decrypted = decryptCredentials(encryptedUnderA, keyring);
  assert.deepStrictEqual(decrypted, creds, "Keyring must fall back to previous key to decrypt existing records");

  // Encrypted under current Key B
  const encryptedUnderB = encryptCredentials(creds, KEY_32_B, 1);
  const decryptedB = decryptCredentials(encryptedUnderB, keyring);
  assert.deepStrictEqual(decryptedB, creds, "Keyring must decrypt records encrypted with current key");
});

test("Crypto 4: Legacy Credential Migration into Dedicated Key with Plaintext Check", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT);
    INSERT INTO users (id, username) VALUES (1, 'testuser');
  `);
  livetvMigrations.up(db);

  const creds1 = { user: "provider1", pass: "p1_secret_pass" };
  const creds2 = { user: "provider2", pass: "p2_secret_pass" };

  // Encrypt with legacy JWT_FALLBACK
  const legacyEnc1 = encryptCredentials(creds1, JWT_FALLBACK, 1);
  const legacyEnc2 = encryptCredentials(creds2, JWT_FALLBACK, 1);

  db.prepare(`
    INSERT INTO live_tv_providers (id, user_id, type, name, encrypted_credentials)
    VALUES ('p1', 1, 'playlist', 'Provider 1', ?),
           ('p2', 1, 'playlist', 'Provider 2', ?)
  `).run(legacyEnc1, legacyEnc2);

  // Run migration to KEY_32_A
  const result = migrateCredentialsToDedicatedKey(db, JWT_FALLBACK, KEY_32_A);
  assert.strictEqual(result.migrated, 2);
  assert.strictEqual(result.skipped, 0);

  // Running migration a second time skips already-migrated rows (idempotency)
  const result2 = migrateCredentialsToDedicatedKey(db, JWT_FALLBACK, KEY_32_A);
  assert.strictEqual(result2.migrated, 0);
  assert.strictEqual(result2.skipped, 2);

  // Verify records in DB are decryptable with KEY_32_A
  const row1 = db.prepare("SELECT encrypted_credentials FROM live_tv_providers WHERE id='p1'").get();
  const decrypted1 = decryptCredentials(row1.encrypted_credentials, KEY_32_A);
  assert.deepStrictEqual(decrypted1, creds1);

  // Verify NO plaintext appears in the database table
  assert.strictEqual(row1.encrypted_credentials.includes("p1_secret_pass"), false, "Plaintext password must not appear in DB");

  db.close();
});
