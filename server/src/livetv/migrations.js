"use strict";

const MIGRATION_VERSION = "20261101_01_livetv_foundation";
const MIGRATION_V2 = "20261101_02_epg_staging";

/**
 * Applies Live TV schema migrations inside a single database transaction.
 * Compatible with WAL mode and idempotent.
 * 
 * @param {import("better-sqlite3").Database} db 
 */
function up(db) {
  const runMigration = db.transaction(() => {
    // 1. Schema migrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const alreadyApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(MIGRATION_VERSION);
    if (alreadyApplied) return false;

    // 2. live_tv_providers
    db.exec(`
      CREATE TABLE IF NOT EXISTS live_tv_providers (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        encrypted_credentials TEXT,
        epg_url TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_live_tv_providers_user ON live_tv_providers(user_id, profile_id);
    `);

    // 3. live_tv_channels
    db.exec(`
      CREATE TABLE IF NOT EXISTS live_tv_channels (
        id TEXT PRIMARY KEY,
        provider_id TEXT REFERENCES live_tv_providers(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
        channel_number INTEGER,
        name TEXT NOT NULL,
        logo_url TEXT,
        category TEXT DEFAULT 'General',
        stream_url TEXT NOT NULL,
        tvg_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_live_tv_channels_provider ON live_tv_channels(provider_id);
      CREATE INDEX IF NOT EXISTS idx_live_tv_channels_profile ON live_tv_channels(user_id, profile_id);
      CREATE INDEX IF NOT EXISTS idx_live_tv_channels_category ON live_tv_channels(category);
    `);

    // 4. live_tv_favorites
    db.exec(`
      CREATE TABLE IF NOT EXISTS live_tv_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        channel_id TEXT NOT NULL REFERENCES live_tv_channels(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(profile_id, channel_id)
      );
      CREATE INDEX IF NOT EXISTS idx_live_tv_favorites_profile ON live_tv_favorites(profile_id);
    `);

    // 5. live_tv_history
    db.exec(`
      CREATE TABLE IF NOT EXISTS live_tv_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        channel_id TEXT NOT NULL REFERENCES live_tv_channels(id) ON DELETE CASCADE,
        watched_at TEXT NOT NULL DEFAULT (datetime('now')),
        duration_seconds INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_live_tv_history_profile ON live_tv_history(profile_id, watched_at DESC);
    `);

    // 6. epg_programs
    db.exec(`
      CREATE TABLE IF NOT EXISTS epg_programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL REFERENCES live_tv_channels(id) ON DELETE CASCADE,
        tvg_id TEXT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        start_utc TEXT NOT NULL,
        stop_utc TEXT NOT NULL,
        category TEXT DEFAULT '',
        poster_url TEXT DEFAULT '',
        UNIQUE(channel_id, start_utc, stop_utc)
      );
      CREATE INDEX IF NOT EXISTS idx_epg_programs_channel_time ON epg_programs(channel_id, start_utc, stop_utc);
    `);

    // 7. epg_sync_jobs (Import job locking)
    db.exec(`
      CREATE TABLE IF NOT EXISTS epg_sync_jobs (
        job_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id TEXT REFERENCES live_tv_providers(id) ON DELETE CASCADE,
        job_type TEXT NOT NULL DEFAULT 'playlist_import',
        status TEXT NOT NULL,
        channels_found INTEGER DEFAULT 0,
        channels_imported INTEGER DEFAULT 0,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        completed_at TEXT,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_epg_sync_jobs_active ON epg_sync_jobs(user_id, status, expires_at);
    `);

    db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(MIGRATION_VERSION);
    return true;
  });

  const appliedV1 = runMigration();

  const runV2 = db.transaction(() => {
    const v2Applied = db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(MIGRATION_V2);
    if (v2Applied) return false;

    db.exec(`
      CREATE TABLE IF NOT EXISTS epg_programs_staging (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        tvg_id TEXT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        start_utc TEXT NOT NULL,
        stop_utc TEXT NOT NULL,
        category TEXT DEFAULT '',
        poster_url TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_epg_staging_job ON epg_programs_staging(job_id);
    `);

    db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(MIGRATION_V2);
    return true;
  });

  const appliedV2 = runV2();
  return appliedV1 || appliedV2;
}

/**
 * Rolls back Live TV schema migrations.
 * @param {import("better-sqlite3").Database} db 
 */
function down(db) {
  const runRollback = db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS epg_programs_staging;
      DROP TABLE IF EXISTS epg_sync_jobs;
      DROP TABLE IF EXISTS epg_programs;
      DROP TABLE IF EXISTS live_tv_history;
      DROP TABLE IF EXISTS live_tv_favorites;
      DROP TABLE IF EXISTS live_tv_channels;
      DROP TABLE IF EXISTS live_tv_providers;
      DELETE FROM schema_migrations WHERE version IN ('${MIGRATION_VERSION}', '${MIGRATION_V2}');
    `);
    return true;
  });

  return runRollback();
}

module.exports = {
  MIGRATION_VERSION,
  up,
  down
};
