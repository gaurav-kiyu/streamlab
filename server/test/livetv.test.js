"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const { deriveKey, encryptCredentials, decryptCredentials, redactUrl } = require("../src/livetv/crypto");
const { parseM3U } = require("../src/livetv/m3u-parser");
const { isForbiddenIP, isForbiddenIPv4, isForbiddenIPv6, validateAndPinUrl } = require("../src/livetv/ssrf");
const livetvMigrations = require("../src/livetv/migrations");
const { ChannelRepository, ImportJobManager } = require("../src/livetv/repository");
const { OfficialChannelProvider, PlaylistProvider } = require("../src/livetv/providers");

const TEST_SECRET = "streamlab_phase16_test_secret_32_characters_minimum!";

test("Live TV 1: AES-256-GCM Credential Encryption & URL Redaction", () => {
  const creds = { username: "iptv_user", token: "super_secret_token_xyz" };
  const encrypted = encryptCredentials(creds, TEST_SECRET);
  assert.ok(typeof encrypted === "string");
  assert.ok(!encrypted.includes("super_secret_token_xyz"), "Plaintext must not appear in encrypted payload");

  const decrypted = decryptCredentials(encrypted, TEST_SECRET);
  assert.deepStrictEqual(decrypted, creds, "Decrypted credentials must match original");

  // Redaction tests
  const basicAuthUrl = "http://myuser:mypassword123@example.com/playlist.m3u8";
  assert.strictEqual(redactUrl(basicAuthUrl), "http://myuser:REDACTED@example.com/playlist.m3u8");

  const tokenUrl = "https://example.com/live.m3u8?token=secret999&auth=key123";
  assert.strictEqual(redactUrl(tokenUrl), "https://example.com/live.m3u8?token=REDACTED&auth=REDACTED");

  const iptvPathUrl = "http://streamserver.tv/live/alice/mysecretpass/12345.m3u8";
  assert.strictEqual(redactUrl(iptvPathUrl), "http://streamserver.tv/live/alice/REDACTED/12345.m3u8");

  assert.strictEqual(redactUrl("not-a-valid-url"), "[MALFORMED_URL]");
});

test("Live TV 2: M3U Parser (Attributes, Duplicates, Malformed Lines & Truncation)", () => {
  const sampleM3U = `
#EXTM3U x-tvg-url="http://epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="CNN.us" tvg-name="CNN HD" tvg-logo="http://example.com/cnn.png" group-title="News" tvg-chno="101",CNN News USA
http://stream.example.com/cnn.m3u8
#EXTINF:-1 tvg-id="BBC.uk" group-title="News",BBC World News
http://stream.example.com/bbc.m3u8
# Duplicate stream URL
#EXTINF:-1 tvg-id="BBC.uk.dup" group-title="News",BBC Duplicate
http://stream.example.com/bbc.m3u8
# Malformed line without stream URL (followed immediately by another EXTINF)
#EXTINF:-1 tvg-id="Ghost",Ghost Channel
# Random comment
#EXTINF:-1 group-title="Sports" tvg-chno="200",ESPN Sports
http://stream.example.com/espn.m3u8
  `.trim();

  const result = parseM3U(sampleM3U, { maxChannels: 10 });
  assert.strictEqual(result.epgUrl, "http://epg.example.com/guide.xml");
  assert.strictEqual(result.channels.length, 3, "Must de-duplicate identical stream URLs");

  const cnn = result.channels[0];
  assert.strictEqual(cnn.name, "CNN HD");
  assert.strictEqual(cnn.category, "News");
  assert.strictEqual(cnn.channelNumber, 101);
  assert.strictEqual(cnn.logo, "http://example.com/cnn.png");
  assert.strictEqual(cnn.tvgId, "CNN.us");

  const espn = result.channels[2];
  assert.strictEqual(espn.name, "ESPN Sports");
  assert.strictEqual(espn.channelNumber, 200);

  // Test truncation ceiling
  const truncResult = parseM3U(sampleM3U, { maxChannels: 2 });
  assert.strictEqual(truncResult.channels.length, 2);
  assert.strictEqual(truncResult.truncated, true);
});

test("Live TV 3: Database Migrations, Transactional Rollback & Idempotency", () => {
  const tmpDir = path.join(__dirname, "test_livetv_db");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "migration_test.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const testDb = new Database(dbPath);
  testDb.pragma("journal_mode = WAL");
  testDb.pragma("foreign_keys = ON");

  // Setup mock users and profiles tables
  testDb.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT);
  `);

  // 1. Run migration UP
  const appliedFirst = livetvMigrations.up(testDb);
  assert.strictEqual(appliedFirst, true);

  // Verify tables exist
  const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert.ok(tables.includes("live_tv_providers"));
  assert.ok(tables.includes("live_tv_channels"));
  assert.ok(tables.includes("live_tv_favorites"));
  assert.ok(tables.includes("live_tv_history"));
  assert.ok(tables.includes("epg_programs"));
  assert.ok(tables.includes("epg_sync_jobs"));

  // 2. Idempotency test (running UP again returns false)
  const appliedSecond = livetvMigrations.up(testDb);
  assert.strictEqual(appliedSecond, false);

  // 3. Rollback DOWN
  const rolledBack = livetvMigrations.down(testDb);
  assert.strictEqual(rolledBack, true);

  const tablesAfterDown = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert.ok(!tablesAfterDown.includes("live_tv_providers"));
  assert.ok(!tablesAfterDown.includes("live_tv_channels"));

  testDb.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("Live TV 4: SSRF Defensive Guard & IP Range Verification", async () => {
  // Prohibited IPv4 ranges
  assert.strictEqual(isForbiddenIPv4("127.0.0.1"), true, "Loopback must be blocked");
  assert.strictEqual(isForbiddenIPv4("127.1.2.3"), true, "127/8 range must be blocked");
  assert.strictEqual(isForbiddenIPv4("10.0.0.1"), true, "10/8 private must be blocked");
  assert.strictEqual(isForbiddenIPv4("172.16.0.1"), true, "172.16/12 private must be blocked");
  assert.strictEqual(isForbiddenIPv4("172.31.255.255"), true, "172.16/12 private must be blocked");
  assert.strictEqual(isForbiddenIPv4("192.168.1.1"), true, "192.168/16 private must be blocked");
  assert.strictEqual(isForbiddenIPv4("169.254.169.254"), true, "AWS/GCP metadata must be blocked");
  assert.strictEqual(isForbiddenIPv4("100.64.0.1"), true, "CGNAT must be blocked");
  assert.strictEqual(isForbiddenIPv4("0.0.0.0"), true, "Current network must be blocked");
  assert.strictEqual(isForbiddenIPv4("224.0.0.1"), true, "Multicast must be blocked");
  assert.strictEqual(isForbiddenIPv4("240.0.0.1"), true, "Reserved must be blocked");

  // Permitted public IPv4
  assert.strictEqual(isForbiddenIPv4("8.8.8.8"), false, "Public Google DNS must be allowed");
  assert.strictEqual(isForbiddenIPv4("1.1.1.1"), false, "Public Cloudflare DNS must be allowed");
  assert.strictEqual(isForbiddenIPv4("151.101.1.69"), false, "Public CDN must be allowed");

  // Prohibited IPv6
  assert.strictEqual(isForbiddenIPv6("::1"), true, "IPv6 Loopback must be blocked");
  assert.strictEqual(isForbiddenIPv6("fc00::1"), true, "IPv6 ULA must be blocked");
  assert.strictEqual(isForbiddenIPv6("fd12:3456::1"), true, "IPv6 ULA must be blocked");
  assert.strictEqual(isForbiddenIPv6("fe80::1"), true, "IPv6 Link-Local must be blocked");
  assert.strictEqual(isForbiddenIPv6("ff02::1"), true, "IPv6 Multicast must be blocked");
  assert.strictEqual(isForbiddenIPv6("::ffff:127.0.0.1"), true, "IPv4-mapped loopback must be blocked");
  assert.strictEqual(isForbiddenIPv6("::ffff:192.168.0.1"), true, "IPv4-mapped private must be blocked");

  // validateAndPinUrl rejects forbidden schemes & IPs
  await assert.rejects(
    async () => await validateAndPinUrl("file:///etc/passwd"),
    { code: "UNSUPPORTED_PROTOCOL" }
  );

  await assert.rejects(
    async () => await validateAndPinUrl("ftp://example.com/test.m3u"),
    { code: "UNSUPPORTED_PROTOCOL" }
  );

  await assert.rejects(
    async () => await validateAndPinUrl("http://127.0.0.1:8080/admin"),
    { code: "FORBIDDEN_IP_RANGE" }
  );

  await assert.rejects(
    async () => await validateAndPinUrl("http://169.254.169.254/latest/meta-data"),
    { code: "FORBIDDEN_IP_RANGE" }
  );
});

test("Live TV 5: Provider Architecture Contracts (Official & Playlist)", async () => {
  const official = new OfficialChannelProvider();
  const channels = await official.getChannels();
  assert.ok(Array.isArray(channels));
  assert.ok(channels.length >= 3);
  assert.strictEqual(channels[0].id, "official_nasa_tv");
  assert.ok(channels[0].streamUrl.startsWith("https://"));

  const streamInfo = await official.getStreamUrl("official_nasa_tv");
  assert.strictEqual(streamInfo.streamUrl, channels[0].streamUrl);

  const playlist = new PlaylistProvider({
    id: "test_pl",
    rawContent: `
#EXTM3U
#EXTINF:-1 tvg-name="Test Channel" group-title="General",Test Channel
https://test.stream/live.m3u8
    `.trim()
  });

  const plChannels = await playlist.getChannels();
  assert.strictEqual(plChannels.length, 1);
  assert.strictEqual(plChannels[0].name, "Test Channel");
  assert.strictEqual(plChannels[0].streamUrl, "https://test.stream/live.m3u8");
});

test("Live TV 6: Channel Repository & Profile Isolation", () => {
  const tmpDir = path.join(__dirname, "test_repo_db");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "repo_test.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT);
  `);
  livetvMigrations.up(db);

  db.prepare("INSERT INTO users (id, username) VALUES (1, 'alice'), (2, 'bob')").run();
  db.prepare("INSERT INTO profiles (id, user_id, name) VALUES (10, 1, 'Alice Profile 1'), (11, 1, 'Alice Profile 2'), (20, 2, 'Bob Profile 1')").run();

  const repo = new ChannelRepository(db, TEST_SECRET);

  // 1. Alice creates a provider in Profile 10
  const aliceProvider = repo.createProvider(1, 10, {
    name: "Alice IPTV",
    type: "playlist",
    url: "http://example.com/playlist.m3u8?token=secret123"
  });
  assert.ok(aliceProvider.id);
  assert.ok(!aliceProvider.url.includes("secret123"), "URL must be redacted in DB display field");

  // 2. Alice saves channels
  const channels = [
    { name: "News 1", category: "News", channelNumber: 1, streamUrl: "http://stream1.m3u8" },
    { name: "Sports 1", category: "Sports", channelNumber: 2, streamUrl: "http://stream2.m3u8" }
  ];
  repo.saveChannels(1, 10, aliceProvider.id, channels);

  // Alice queries her channels
  const aliceChannels = repo.getChannels(1, 10);
  assert.strictEqual(aliceChannels.length, 2);

  // 3. Profile Isolation & Cross-Account Isolation
  // Bob queries his channels -> MUST BE 0!
  const bobChannels = repo.getChannels(2, 20);
  assert.strictEqual(bobChannels.length, 0, "Bob must not see Alice's channels");

  // Bob tries to delete Alice's provider -> returns false
  const deleteAttempt = repo.removeProvider(2, aliceProvider.id);
  assert.strictEqual(deleteAttempt, false, "Bob cannot delete Alice's provider");

  // 4. Favorites Toggle
  const favResult = repo.toggleFavorite(1, 10, aliceChannels[0].id);
  assert.strictEqual(favResult.isFavorite, true);

  const aliceFavs = repo.getChannels(1, 10, { favoritesOnly: true });
  assert.strictEqual(aliceFavs.length, 1);
  assert.strictEqual(aliceFavs[0].name, "News 1");

  // Bob cannot favorite Alice's channel (throws unauthorized)
  assert.throws(() => {
    repo.toggleFavorite(2, 20, aliceChannels[0].id);
  }, /unauthorized/i);

  // 5. Watch History
  repo.recordHistory(1, 10, aliceChannels[0].id, 120);
  const recent = repo.getRecent(1, 10);
  assert.strictEqual(recent.length, 1);
  assert.strictEqual(recent[0].id, aliceChannels[0].id);

  db.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test("Live TV 7: Import Job Lock Manager & Stale Lock Recovery", () => {
  const tmpDir = path.join(__dirname, "test_job_db");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "job_test.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT);
  `);
  livetvMigrations.up(db);

  db.prepare("INSERT INTO users (id, username) VALUES (1, 'alice')").run();
  db.prepare("INSERT INTO live_tv_providers (id, user_id, type, name) VALUES ('prv_1', 1, 'playlist', 'Test')").run();

  const jobMgr = new ImportJobManager(db);

  // 1. Acquire initial lock
  const lock1 = jobMgr.acquireLock(1, "prv_1", "playlist_import", 30);
  assert.strictEqual(lock1.locked, true);
  assert.ok(lock1.jobId);

  // 2. Simultaneous second acquire for same user -> MUST BE BLOCKED
  const lock2 = jobMgr.acquireLock(1, "prv_1", "playlist_import", 30);
  assert.strictEqual(lock2.locked, false, "Concurrent job for same user must be blocked");
  assert.strictEqual(lock2.activeJob.job_id, lock1.jobId);

  // 3. Release lock
  jobMgr.releaseLock(lock1.jobId, "completed", { channelsFound: 50, channelsImported: 50 });

  // 4. Now acquiring lock succeeds again
  const lock3 = jobMgr.acquireLock(1, "prv_1", "playlist_import", 30);
  assert.strictEqual(lock3.locked, true);

  // 5. Test stale lock recovery (simulate lock expired 10 minutes ago)
  db.prepare("UPDATE epg_sync_jobs SET expires_at = datetime('now', '-10 minutes') WHERE job_id=?").run(lock3.jobId);

  // Acquiring lock triggers cleanup and succeeds
  const lock4 = jobMgr.acquireLock(1, "prv_1", "playlist_import", 30);
  assert.strictEqual(lock4.locked, true, "Stale expired lock must be automatically recovered");

  db.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});
