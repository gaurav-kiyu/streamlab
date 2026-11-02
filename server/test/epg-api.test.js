"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
const TEST_DB = path.join(__dirname, "test_epg_api.db");
process.env.DB_FILE = TEST_DB;
process.env.ADMIN_INITIAL_PASSWORD = "EpgTestAdminPassword123!";
process.env.JWT_SECRET = "streamlab_epg_api_test_secret_32_characters_minimum!";
process.env.LIVETV_ENCRYPTION_KEY = "streamlab_epg_dedicated_key_32_chars_long!";

if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

const { app, db } = require("../server");
const { EPGRepository } = require("../src/livetv/epg-repository");

let server;
let baseUrl;
let userToken;
let userProfileId;
let testProviderId;
let testChannelId;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Create test user and default profile
  const signupRes = await request("/api/auth/signup", {
    method: "POST",
    body: { username: "epguser", password: "SecureEpgPassword123!" },
  });
  assert.strictEqual(signupRes.status, 201);
  userToken = signupRes.data.token;

  const profRes = await request("/api/profiles", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.strictEqual(profRes.status, 200);
  userProfileId = profRes.data.profiles[0].id;

  // Create a provider and channel to test against
  const provRes = await request("/api/livetv/providers", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      name: "EPG Test Provider",
      type: "playlist",
      rightsAcknowledged: true,
      profileId: userProfileId,
    },
  });
  assert.strictEqual(provRes.status, 201);
  testProviderId = provRes.data.provider.id;
  const providerId = testProviderId;

  // Import an initial channel with epg_channel_id = "test.channel.1"
  const m3uContent = `
#EXTM3U
#EXTINF:-1 tvg-id="test.channel.1" tvg-name="Test News 24" group-title="News",Test News 24
https://stream.example.com/live/news.m3u8
#EXTINF:-1 tvg-id="test.channel.2" tvg-name="Test Sports" group-title="Sports",Test Sports
https://stream.example.com/live/sports.m3u8
  `.trim();

  const importM3uRes = await request("/api/livetv/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      providerId,
      profileId: userProfileId,
      content: m3uContent,
      rightsAcknowledged: true,
    },
  });
  assert.strictEqual(importM3uRes.status, 200);

  const chRes = await request(`/api/livetv/channels?profileId=${userProfileId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.strictEqual(chRes.status, 200);
  assert.strictEqual(chRes.data.channels.length, 2);
  testChannelId = chRes.data.channels.find((c) => c.tvg_id === "test.channel.1").id;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

async function request(endpoint, options = {}) {
  options.headers = options.headers || {};
  if (options.body && typeof options.body === "object") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

test("EPG API 1: Rights Acknowledgement Enforcement", async () => {
  const res = await request("/api/livetv/epg/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      content: "<tv></tv>",
      rightsAcknowledged: false,
    },
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.data.code, "RIGHTS_ACKNOWLEDGEMENT_REQUIRED");
});

test("EPG API 2: XXE Injection Rejection in EPG Ingestion", async () => {
  const xxeXml = `<?xml version="1.0"?>
  <!DOCTYPE tv [ <!ENTITY test "xxe_payload"> ]>
  <tv><channel id="1"><display-name>&test;</display-name></channel></tv>`;

  const res = await request("/api/livetv/epg/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      providerId: testProviderId,
      content: xxeXml,
      rightsAcknowledged: true,
    },
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.data.code, "XXE_DETECTED");
});

test("EPG API 3: Ingest XMLTV with Staged Parsing & Atomic Swap", async () => {
  const now = new Date();
  const startTime = new Date(now.getTime() - 15 * 60000).toISOString(); // Started 15m ago
  const stopTime = new Date(now.getTime() + 45 * 60000).toISOString(); // Ends in 45m
  const nextStartTime = stopTime;
  const nextStopTime = new Date(now.getTime() + 105 * 60000).toISOString();

  // Convert to XMLTV timestamp string format (YYYYMMDDHHMMSS +0000)
  function toXmltvTime(isoStr) {
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`;
  }

  const xmltvData = `<?xml version="1.0" encoding="UTF-8"?>
  <tv>
    <channel id="test.channel.1">
      <display-name>Test News 24 HD</display-name>
      <icon src="https://example.com/logo1.png" />
    </channel>

    <programme start="${toXmltvTime(startTime)}" stop="${toXmltvTime(stopTime)}" channel="test.channel.1">
      <title lang="en">Live Prime Time Debate</title>
      <desc lang="en">In-depth analysis of breaking news.</desc>
      <category>News</category>
    </programme>

    <programme start="${toXmltvTime(nextStartTime)}" stop="${toXmltvTime(nextStopTime)}" channel="test.channel.1">
      <title lang="en">Late Night Headlines</title>
      <desc lang="en">Roundup of the day's top national stories.</desc>
      <category>News</category>
    </programme>
  </tv>`;

  const importRes = await request("/api/livetv/epg/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      providerId: testProviderId,
      content: xmltvData,
      rightsAcknowledged: true,
    },
  });

  assert.strictEqual(importRes.status, 200);
  assert.strictEqual(importRes.data.success, true);
  assert.strictEqual(importRes.data.programsImported, 2);
  assert.strictEqual(importRes.data.channelsMatched, 1);
});

test("EPG API 4: Current & Next Programme Lookup", async () => {
  // Query channel with active EPG
  const curRes = await request(`/api/livetv/epg/channels/${testChannelId}/current`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  assert.strictEqual(curRes.status, 200);
  assert.ok(curRes.data.now);
  assert.strictEqual(curRes.data.now.title, "Live Prime Time Debate");
  assert.strictEqual(curRes.data.now.category, "News");

  assert.ok(curRes.data.next);
  assert.strictEqual(curRes.data.next.title, "Late Night Headlines");

  // Query channel with missing / no EPG -> must gracefully fallback
  const fallbackRes = await request(`/api/livetv/epg/channels/999999/current`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  assert.strictEqual(fallbackRes.status, 200);
  assert.ok(fallbackRes.data.now);
  assert.strictEqual(fallbackRes.data.now.title, "Program Information Unavailable");
  assert.strictEqual(fallbackRes.data.next, null);
});

test("EPG API 5: Multi-Channel Guide Matrix", async () => {
  const guideRes = await request(`/api/livetv/epg/guide?profileId=${userProfileId}&hours=4`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  assert.strictEqual(guideRes.status, 200);
  assert.ok(Array.isArray(guideRes.data.guide));
  assert.strictEqual(guideRes.data.guide.length, 2, "Must return all profile channels in guide");

  const newsGuide = guideRes.data.guide.find((g) => g.id === testChannelId);
  assert.ok(newsGuide);
  assert.strictEqual(newsGuide.programs.length, 2);
  assert.strictEqual(newsGuide.programs[0].title, "Live Prime Time Debate");
});

test("EPG Repository: Staging Isolation & Discard Safeguard", () => {
  const epgRepo = new EPGRepository(db);

  // 1. Stage programs for a job
  const jobId = "test-job-staging-isolation-123";
  const dummyPrograms = [
    {
      channelId: "test.channel.1",
      title: "Temporary Staged Show",
      description: "Should never leak to production if discarded",
      category: "Test",
      startUtc: "2026-11-01T20:00:00.000Z",
      stopUtc: "2026-11-01T21:00:00.000Z",
      posterUrl: null,
    },
  ];

  epgRepo.stagePrograms(jobId, dummyPrograms);

  // Verify staging has the row
  const count = db.prepare("SELECT COUNT(*) as c FROM epg_programs_staging WHERE job_id = ?").get(jobId).c;
  assert.strictEqual(count, 1);

  // 2. Discard staging rows
  epgRepo.discardStagedPrograms(jobId);
  const countAfter = db.prepare("SELECT COUNT(*) as c FROM epg_programs_staging WHERE job_id = ?").get(jobId).c;
  assert.strictEqual(countAfter, 0);

  // 3. Cleanup old programs
  const cleaned = epgRepo.cleanupOldPrograms(24);
  assert.ok(typeof cleaned === "number");
});
