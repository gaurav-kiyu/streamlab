"use strict";

const test = require("node:test");
const assert = require("node:assert");
const Database = require("better-sqlite3");
const livetvMigrations = require("../src/livetv/migrations");
const { EPGRepository } = require("../src/livetv/epg-repository");
const { ImportJobManager, ChannelRepository } = require("../src/livetv/repository");

function setupTestDatabase() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT);
    CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT);
    INSERT INTO users (id, username) VALUES (1, 'user1'), (2, 'user2');
    INSERT INTO profiles (id, user_id, name) VALUES (1, 1, 'Default 1'), (2, 2, 'Default 2');
  `);
  livetvMigrations.up(db);
  return db;
}

test("EPG Atomic 1: Ingestion Pipeline & Safe Discard on Error", () => {
  const db = setupTestDatabase();
  const epgRepo = new EPGRepository(db);

  // Setup initial active EPG dataset
  db.exec(`
    INSERT INTO live_tv_providers (id, user_id, type, name) VALUES ('prov1', 1, 'playlist', 'Prov 1');
    INSERT INTO live_tv_channels (id, provider_id, user_id, profile_id, channel_number, name, stream_url, tvg_id)
    VALUES ('ch1', 'prov1', 1, 1, 101, 'DD News', 'https://stream.example.com/ch1.m3u8', 'dd.news');
    
    INSERT INTO epg_programs (channel_id, tvg_id, title, start_utc, stop_utc)
    VALUES ('ch1', 'dd.news', 'Baseline Prime News', '2026-11-01T12:00:00.000Z', '2026-11-01T13:00:00.000Z');
  `);

  // Verify initial count is 1
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM epg_programs").get().c, 1);

  // Simulate an interrupted or failed import in staging
  const failedJobId = "job_failed_sync_001";
  epgRepo.stagePrograms(failedJobId, [
    {
      channelId: "dd.news",
      title: "Corrupt Incomplete Show",
      startUtc: "2026-11-01T14:00:00.000Z",
      stopUtc: "2026-11-01T15:00:00.000Z"
    }
  ]);

  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM epg_programs_staging WHERE job_id=?").get(failedJobId).c, 1);

  // Discard staging on error
  epgRepo.discardStagedPrograms(failedJobId);
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM epg_programs_staging WHERE job_id=?").get(failedJobId).c, 0);

  // Baseline EPG programs must remain completely unharmed
  const activeProg = db.prepare("SELECT title FROM epg_programs WHERE channel_id='ch1'").get();
  assert.strictEqual(activeProg.title, "Baseline Prime News", "Failed import must never corrupt existing EPG data");

  db.close();
});

test("EPG Atomic 2: Concurrent Import Job Locking & Multi-Account Isolation", () => {
  const db = setupTestDatabase();
  const lockMgr = new ImportJobManager(db);

  db.exec(`
    INSERT INTO live_tv_providers (id, user_id, type, name) 
    VALUES ('prov1', 1, 'playlist', 'P1'), ('prov2', 2, 'playlist', 'P2');
  `);

  // User 1 acquires lock
  const lock1 = lockMgr.acquireLock(1, "prov1", "epg_sync", 60);
  assert.strictEqual(lock1.locked, true);

  // User 1 attempts second concurrent lock -> must be BLOCKED
  const lock1Blocked = lockMgr.acquireLock(1, "prov1", "epg_sync", 60);
  assert.strictEqual(lock1Blocked.locked, false, "Concurrent job for same user must be blocked");
  assert.strictEqual(lock1Blocked.activeJob.job_id, lock1.jobId);

  // User 2 acquires lock -> must SUCCEED (account isolation)
  const lock2 = lockMgr.acquireLock(2, "prov2", "epg_sync", 60);
  assert.strictEqual(lock2.locked, true, "Distinct accounts must not block each other");

  // User 1 releases lock
  lockMgr.releaseLock(lock1.jobId, "completed", { channelsImported: 10 });
  const lock1After = lockMgr.acquireLock(1, "prov1", "epg_sync", 60);
  assert.strictEqual(lock1After.locked, true, "User 1 can acquire new lock after previous job releases");

  db.close();
});

test("EPG Atomic 3: Stale Job Recovery & Abandoned Staging Cleanup", () => {
  const db = setupTestDatabase();
  const lockMgr = new ImportJobManager(db);
  const epgRepo = new EPGRepository(db);

  db.exec(`
    INSERT INTO live_tv_providers (id, user_id, type, name) VALUES ('prov1', 1, 'playlist', 'P1');
    -- Insert a running job that expired 5 minutes ago
    INSERT INTO epg_sync_jobs (job_id, user_id, provider_id, job_type, status, started_at, expires_at)
    VALUES ('job_stale_1', 1, 'prov1', 'epg_sync', 'running', datetime('now', '-10 minutes'), datetime('now', '-5 minutes'));
    
    -- Insert abandoned staging records created 2 hours ago
    INSERT INTO epg_programs_staging (job_id, channel_id, title, start_utc, stop_utc, created_at)
    VALUES ('job_stale_1', 'ch1', 'Abandoned Programme', '2026-11-01T10:00:00.000Z', '2026-11-01T11:00:00.000Z', datetime('now', '-2 hours'));
  `);

  // Recover stale jobs
  const jobResult = lockMgr.cleanupStaleJobs();
  assert.strictEqual(jobResult.changes, 1);
  const updatedJob = db.prepare("SELECT status, error_message FROM epg_sync_jobs WHERE job_id='job_stale_1'").get();
  assert.strictEqual(updatedJob.status, "failed");
  assert.strictEqual(updatedJob.error_message, "STALE_LOCK_RECOVERED");

  // Cleanup abandoned staging
  const stagingCleaned = epgRepo.cleanupStaleStaging(1); // older than 1 hour
  assert.strictEqual(stagingCleaned, 1);
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM epg_programs_staging").get().c, 0);

  db.close();
});

test("EPG Atomic 4: Query Latency Benchmark with 1,000 Representative Programmes", () => {
  const db = setupTestDatabase();
  const epgRepo = new EPGRepository(db);

  // Setup 20 channels
  const insertChannelStmt = db.prepare(`
    INSERT INTO live_tv_channels (id, provider_id, user_id, profile_id, channel_number, name, stream_url, tvg_id)
    VALUES (?, 'prov1', 1, 1, ?, ?, 'https://stream.example.com/live.m3u8', ?)
  `);

  db.exec("INSERT INTO live_tv_providers (id, user_id, type, name) VALUES ('prov1', 1, 'playlist', 'P1')");

  for (let c = 1; c <= 20; c++) {
    insertChannelStmt.run(`ch_${c}`, c * 10, `Channel ${c}`, `tvg.ch.${c}`);
  }

  // Populate 1,000 representative programmes (50 per channel across a 24-hour window)
  const insertProgStmt = db.prepare(`
    INSERT INTO epg_programs (channel_id, tvg_id, title, description, start_utc, stop_utc, category)
    VALUES (?, ?, ?, 'Detailed episode synopsis for benchmark testing', ?, ?, 'Entertainment')
  `);

  const baseMs = Date.now();
  const tx = db.transaction(() => {
    for (let c = 1; c <= 20; c++) {
      for (let p = 0; p < 50; p++) {
        const start = new Date(baseMs + (p - 5) * 30 * 60000).toISOString();
        const stop = new Date(baseMs + (p - 4) * 30 * 60000).toISOString();
        insertProgStmt.run(`ch_${c}`, `tvg.ch.${c}`, `Show ${p} on Ch ${c}`, start, stop);
      }
    }
  });
  tx();

  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM epg_programs").get().c, 1000);

  // Measure 1: getCurrentAndNext(channelId) over 200 iterations
  const singleChannelLatencies = [];
  for (let i = 0; i < 200; i++) {
    const channelId = `ch_${(i % 20) + 1}`;
    const t0 = process.hrtime.bigint();
    const info = epgRepo.getCurrentAndNext(channelId);
    const t1 = process.hrtime.bigint();
    assert.ok(info.current);
    singleChannelLatencies.push(Number(t1 - t0) / 1e6); // ms
  }

  singleChannelLatencies.sort((a, b) => a - b);
  const avgSingle = singleChannelLatencies.reduce((a, b) => a + b, 0) / singleChannelLatencies.length;
  const p95Single = singleChannelLatencies[Math.floor(singleChannelLatencies.length * 0.95)];

  // Measure 2: getMultiChannelGuide (20 channels across 4 hours) over 50 iterations
  const guideLatencies = [];
  const startWindow = new Date(baseMs - 3600000).toISOString();
  const endWindow = new Date(baseMs + 4 * 3600000).toISOString();

  for (let i = 0; i < 50; i++) {
    const t0 = process.hrtime.bigint();
    const guide = epgRepo.getMultiChannelGuide(1, 1, startWindow, endWindow);
    const t1 = process.hrtime.bigint();
    assert.strictEqual(guide.channels.length, 20);
    guideLatencies.push(Number(t1 - t0) / 1e6); // ms
  }

  guideLatencies.sort((a, b) => a - b);
  const avgGuide = guideLatencies.reduce((a, b) => a + b, 0) / guideLatencies.length;
  const p95Guide = guideLatencies[Math.floor(guideLatencies.length * 0.95)];

  console.log(`\n  --- EPG Benchmark Results (1,000 Programmes, 20 Channels) ---`);
  console.log(`  Single Channel Current/Next: avg = ${avgSingle.toFixed(3)} ms, p95 = ${p95Single.toFixed(3)} ms`);
  console.log(`  20-Channel Guide (4h Window): avg = ${avgGuide.toFixed(3)} ms, p95 = ${p95Guide.toFixed(3)} ms\n`);

  // Assert realistic performance bounds
  assert.ok(avgSingle < 2.0, `Single channel lookup average (${avgSingle.toFixed(3)}ms) must be under 2.0ms`);
  assert.ok(avgGuide < 10.0, `20-channel guide lookup average (${avgGuide.toFixed(3)}ms) must be under 10.0ms`);

  db.close();
});
