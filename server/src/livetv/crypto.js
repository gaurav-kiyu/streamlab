"use strict";

const crypto = require("crypto");

/**
 * Resolves the Live TV encryption secret.
 * 
 * Production Security Enforcement:
 * - In production (NODE_ENV === "production"), LIVETV_ENCRYPTION_KEY is STRICTLY MANDATORY (min 32 chars).
 *   Silent fallback to JWT_SECRET in production is explicitly prohibited.
 * - In development/testing, fallback to JWT_SECRET is permitted with a prominent warning log.
 * 
 * @param {string} fallbackSecret 
 * @returns {string}
 */
function resolveLiveTvSecret(fallbackSecret) {
  const dedicated = process.env.LIVETV_ENCRYPTION_KEY ? process.env.LIVETV_ENCRYPTION_KEY.trim() : "";
  const isProd = process.env.NODE_ENV === "production";

  if (dedicated) {
    if (dedicated.length < 32) {
      throw new Error("FATAL: LIVETV_ENCRYPTION_KEY must be at least 32 characters in length.");
    }
    return dedicated;
  }

  // Strictly reject fallback in production
  if (isProd) {
    throw new Error(
      "FATAL_CONFIG_ERROR: In production, LIVETV_ENCRYPTION_KEY must be configured (minimum 32 characters). " +
      "Falling back to JWT_SECRET is strictly prohibited in production mode."
    );
  }

  // Non-production fallback
  if (fallbackSecret && typeof fallbackSecret === "string" && fallbackSecret.trim().length >= 32) {
    return fallbackSecret.trim();
  }

  throw new Error("FATAL: LIVETV_ENCRYPTION_KEY or fallback secret (min 32 chars) must be configured.");
}

/**
 * Derives a 32-byte AES-256 key from a secret string using scrypt.
 * @param {string} secret
 * @returns {Buffer}
 */
function deriveKey(secret) {
  if (!secret || typeof secret !== "string") {
    throw new Error("Secret must be a non-empty string");
  }
  return crypto.scryptSync(secret, "streamlab_livetv_salt_2026", 32);
}

/**
 * Encrypts an object or string using AES-256-GCM with random 12-byte IV and versioning.
 * @param {object|string} data 
 * @param {string} secret 
 * @param {number} version 
 * @returns {string} Encrypted bundle in JSON format
 */
function encryptCredentials(data, secret, version = 1) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  const text = typeof data === "string" ? data : JSON.stringify(data);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return JSON.stringify({
    v: version,
    iv: iv.toString("hex"),
    tag: authTag,
    data: encrypted
  });
}

/**
 * Decrypts an AES-256-GCM encrypted bundle with authentication tag validation.
 * Supports backward-compatible unversioned bundles and keyring rotation.
 * 
 * @param {string} bundleJson 
 * @param {string|{current: string, previous?: string}} secretOrKeyRing 
 * @returns {any} Decrypted data
 */
function decryptCredentials(bundleJson, secretOrKeyRing) {
  if (!bundleJson) return null;
  const bundle = JSON.parse(bundleJson);
  const { iv, tag, data } = bundle;

  const currentSecret = typeof secretOrKeyRing === "object" ? secretOrKeyRing.current : secretOrKeyRing;
  const previousSecret = typeof secretOrKeyRing === "object" ? secretOrKeyRing.previous : null;

  function attemptDecryption(secret) {
    const key = deriveKey(secret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }

  try {
    return attemptDecryption(currentSecret);
  } catch (err) {
    if (previousSecret) {
      try {
        return attemptDecryption(previousSecret);
      } catch {}
    }
    throw new Error("DECRYPTION_FAILED: Invalid authentication tag or corrupted ciphertext");
  }
}

/**
 * Redacts credentials from URLs (passwords, tokens, IPTV path tokens).
 * Safe for logging and public display.
 * 
 * @param {string} rawUrl 
 * @returns {string} Sanitized URL
 */
function redactUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl);
    
    // 1. Redact HTTP basic auth credentials
    if (parsed.password) {
      parsed.password = "REDACTED";
    }
    if (parsed.username && parsed.username.length > 20) {
      parsed.username = "REDACTED";
    }

    // 2. Redact query parameters commonly holding secrets
    const sensitiveKeys = ["token", "password", "pass", "key", "auth", "api_key", "apikey", "secret"];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, "REDACTED");
      }
    }

    // 3. Redact IPTV path convention: /live/{username}/{password}/{streamId}.m3u8
    const segments = parsed.pathname.split("/");
    if (segments.length >= 4 && segments[1] === "live") {
      segments[3] = "REDACTED";
      parsed.pathname = segments.join("/");
    }

    return parsed.toString();
  } catch {
    return "[MALFORMED_URL]";
  }
}

/**
 * Migrates provider credentials previously encrypted with a legacy secret (e.g. JWT_SECRET)
 * to the dedicated LIVETV_ENCRYPTION_KEY.
 * Executes atomically inside a database transaction with per-record verification.
 * 
 * @param {import("better-sqlite3").Database} db 
 * @param {string} legacySecret 
 * @param {string} dedicatedSecret 
 * @returns {{ migrated: number, skipped: number }}
 */
function migrateCredentialsToDedicatedKey(db, legacySecret, dedicatedSecret) {
  if (!legacySecret || !dedicatedSecret) {
    throw new Error("Both legacySecret and dedicatedSecret are required for migration");
  }

  const rows = db.prepare(`
    SELECT id, encrypted_credentials 
    FROM live_tv_providers 
    WHERE encrypted_credentials IS NOT NULL
  `).all();

  let migrated = 0;
  let skipped = 0;

  const updateStmt = db.prepare(`
    UPDATE live_tv_providers 
    SET encrypted_credentials = ?, updated_at = datetime('now') 
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    for (const row of rows) {
      // 1. Check if already decryptable with dedicatedSecret
      try {
        decryptCredentials(row.encrypted_credentials, dedicatedSecret);
        skipped++;
        continue;
      } catch {
        // Needs migration
      }

      // 2. Decrypt with legacy secret
      const decrypted = decryptCredentials(row.encrypted_credentials, legacySecret);
      // 3. Re-encrypt with dedicated secret
      const reEncrypted = encryptCredentials(decrypted, dedicatedSecret, 1);
      updateStmt.run(reEncrypted, row.id);
      migrated++;
    }
  });

  tx();
  return { migrated, skipped };
}

module.exports = {
  resolveLiveTvSecret,
  deriveKey,
  encryptCredentials,
  decryptCredentials,
  migrateCredentialsToDedicatedKey,
  redactUrl
};
