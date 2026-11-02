"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
const TEST_DB = path.join(__dirname, "test_livetv_api.db");
process.env.DB_FILE = TEST_DB;
process.env.ADMIN_INITIAL_PASSWORD = "LiveTvApiTestAdmin123!";
process.env.JWT_SECRET = "streamlab_livetv_api_secret_key_32_characters_min!";

if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

const { app, db } = require("../server");

let server;
let baseUrl;
let userToken;
let userProfileId;

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
    body: { username: "tvuser", password: "SecureTvPassword123!" }
  });
  assert.strictEqual(signupRes.status, 201);
  userToken = signupRes.data.token;

  const profRes = await request("/api/profiles", {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(profRes.status, 200);
  userProfileId = profRes.data.profiles[0].id;
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

test("Live TV API: Rights Acknowledgement & Provider Creation", async () => {
  // 1. Rejection without rights acknowledgement
  const rejectRes = await request("/api/livetv/providers", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      name: "My Unverified Playlist",
      type: "playlist",
      rightsAcknowledged: false
    }
  });
  assert.strictEqual(rejectRes.status, 400);
  assert.strictEqual(rejectRes.data.code, "RIGHTS_ACKNOWLEDGEMENT_REQUIRED");

  // 2. Success with rights acknowledgement
  const createRes = await request("/api/livetv/providers", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      name: "My Verified Playlist",
      type: "playlist",
      url: "http://example.com/playlist.m3u8?token=hidden123",
      profileId: userProfileId,
      rightsAcknowledged: true
    }
  });
  assert.strictEqual(createRes.status, 201);
  assert.ok(createRes.data.provider.id);
  assert.ok(!createRes.data.provider.url.includes("hidden123"), "URL must be redacted");
});

test("Live TV API: Playlist Import & Channel Sync", async () => {
  // Create provider
  const provRes = await request("/api/livetv/providers", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      name: "FAST News Network",
      type: "playlist",
      profileId: userProfileId,
      rightsAcknowledged: true
    }
  });
  const providerId = provRes.data.provider.id;

  const rawM3U = `
#EXTM3U
#EXTINF:-1 tvg-name="News 24" tvg-chno="10" group-title="News",News 24 Live
https://stream.example.com/news24.m3u8
#EXTINF:-1 tvg-name="Retro Cinema" tvg-chno="20" group-title="Movies",Retro Cinema
https://stream.example.com/retro.m3u8
  `.trim();

  // Import raw content
  const importRes = await request("/api/livetv/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      providerId,
      profileId: userProfileId,
      content: rawM3U,
      rightsAcknowledged: true
    }
  });
  assert.strictEqual(importRes.status, 200);
  assert.strictEqual(importRes.data.channelsImported, 2);

  // Query channels
  const channelsRes = await request(`/api/livetv/channels?profileId=${userProfileId}`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(channelsRes.status, 200);
  assert.strictEqual(channelsRes.data.channels.length, 2);

  const newsChannel = channelsRes.data.channels.find(c => c.name === "News 24");
  assert.ok(newsChannel);
  assert.strictEqual(newsChannel.category, "News");

  // Query by category filter
  const movieCatRes = await request(`/api/livetv/channels?profileId=${userProfileId}&category=Movies`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(movieCatRes.status, 200);
  assert.strictEqual(movieCatRes.data.channels.length, 1);
  assert.strictEqual(movieCatRes.data.channels[0].name, "Retro Cinema");

  // Toggle Favorite
  const favRes = await request(`/api/livetv/channels/${newsChannel.id}/favorite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: { profileId: userProfileId }
  });
  assert.strictEqual(favRes.status, 200);
  assert.strictEqual(favRes.data.isFavorite, true);

  // Record History
  const histRes = await request(`/api/livetv/channels/${newsChannel.id}/history`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: { profileId: userProfileId, duration: 300 }
  });
  assert.strictEqual(histRes.status, 200);

  // Query Recent
  const recentRes = await request(`/api/livetv/recent?profileId=${userProfileId}`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(recentRes.status, 200);
  assert.strictEqual(recentRes.data.recent.length, 1);
  assert.strictEqual(recentRes.data.recent[0].id, newsChannel.id);

  // Delete Provider -> Cascading channel deletion
  const delRes = await request(`/api/livetv/providers/${providerId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(delRes.status, 200);

  // Channels should now be empty
  const afterDelChannels = await request(`/api/livetv/channels?profileId=${userProfileId}`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(afterDelChannels.data.channels.length, 0);
});
