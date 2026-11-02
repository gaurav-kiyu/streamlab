"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

test("Database Recovery, WAL Mode & Backup/Restore Verification", async () => {
  const tmpDir = path.join(__dirname, "test_db_tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const primaryDbPath = path.join(tmpDir, "primary_test.db");
  const backupDbPath = path.join(tmpDir, "backup_test.db");

  if (fs.existsSync(primaryDbPath)) fs.unlinkSync(primaryDbPath);
  if (fs.existsSync(backupDbPath)) fs.unlinkSync(backupDbPath);

  // 1. Initialize Primary Database & Verify WAL Mode
  const primaryDb = new Database(primaryDbPath);
  const journalMode = primaryDb.pragma("journal_mode = WAL", { simple: true });
  assert.strictEqual(journalMode.toLowerCase(), "wal", "Database must operate in WAL journal mode");

  // 2. Setup Baseline Schema
  primaryDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      token_version INTEGER DEFAULT 1
    );
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      duration INTEGER NOT NULL
    );
    CREATE TABLE config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 3. Insert Test Seed Data (Users, Profiles, Progress, Config)
  primaryDb.prepare("INSERT INTO users (username) VALUES (?)").run("alice");
  const user = primaryDb.prepare("SELECT * FROM users WHERE username=?").get("alice");
  primaryDb.prepare("INSERT INTO profiles (user_id, name) VALUES (?, ?)").run(user.id, "Alice Personal");
  const profile = primaryDb.prepare("SELECT * FROM profiles WHERE user_id=?").get(user.id);

  primaryDb.prepare("INSERT INTO progress (user_id, profile_id, item_id, position, duration) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, profile.id, "ia-big-buck-bunny", 360, 600);

  primaryDb.prepare("INSERT INTO config (key, value) VALUES (?, ?)")
    .run("site_name", JSON.stringify("StreamLab Production"));

  // 4. Perform Live SQLite Backup via better-sqlite3 API
  await primaryDb.backup(backupDbPath);
  assert.ok(fs.existsSync(backupDbPath), "Backup file must be written to disk");
  const backupStat = fs.statSync(backupDbPath);
  assert.ok(backupStat.size > 0, "Backup file size must be non-zero");

  primaryDb.close();

  // 5. Restore from Backup into a New Restored Instance
  const restoredDb = new Database(backupDbPath);
  const restoredJournal = restoredDb.pragma("journal_mode", { simple: true });
  assert.strictEqual(restoredJournal.toLowerCase(), "wal", "Restored database retains WAL settings");

  // Verify Data Integrity on Restored Database
  const restoredUser = restoredDb.prepare("SELECT * FROM users WHERE username=?").get("alice");
  assert.ok(restoredUser, "User 'alice' preserved in backup");
  assert.strictEqual(restoredUser.token_version, 1);

  const restoredProfile = restoredDb.prepare("SELECT * FROM profiles WHERE user_id=?").get(restoredUser.id);
  assert.strictEqual(restoredProfile.name, "Alice Personal");

  const restoredProgress = restoredDb.prepare("SELECT * FROM progress WHERE profile_id=?").get(restoredProfile.id);
  assert.strictEqual(restoredProgress.item_id, "ia-big-buck-bunny");
  assert.strictEqual(restoredProgress.position, 360);
  assert.strictEqual(restoredProgress.duration, 600);

  const restoredConfig = restoredDb.prepare("SELECT * FROM config WHERE key=?").get("site_name");
  assert.strictEqual(JSON.parse(restoredConfig.value), "StreamLab Production");

  // 6. Test Migration Behavior (Adding column without data loss)
  restoredDb.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL;");
  const migratedUser = restoredDb.prepare("SELECT * FROM users WHERE username=?").get("alice");
  assert.strictEqual(migratedUser.phone, null);
  assert.strictEqual(migratedUser.username, "alice");

  restoredDb.close();

  // Cleanup temporary test databases
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});
