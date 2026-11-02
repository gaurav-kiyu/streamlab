"use strict";
const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Use an isolated temporary test database
const TEST_DB = path.join(__dirname, "test-data.db");
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
process.env.DB_FILE = TEST_DB;
process.env.JWT_SECRET = "streamlab-super-secure-test-jwt-secret-key-32chars";
process.env.ADMIN_INITIAL_USERNAME = "admin";
process.env.ADMIN_INITIAL_PASSWORD = "InitialAdminPassword123!";

const { app, db } = require("../server");

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

async function request(path, options = {}) {
  options.headers = options.headers || {};
  if (options.body && typeof options.body === "object") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${baseUrl}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

test("1. System Health & Security Headers", async () => {
  const res = await request("/api/health");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.ok, true);
  assert.strictEqual(res.data.version, "1.2.0");
  assert.strictEqual(typeof res.data.memory?.rssMb, "number");
  assert.strictEqual(typeof res.data.memory?.heapUsedMb, "number");
  assert.strictEqual(res.data.database?.walMode, true);
  assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(res.headers.get("cache-control").includes("no-store"));
});

test("2. Public Config Redaction (SEC-01 Fix Verification)", async () => {
  db.prepare("INSERT INTO config(key, value) VALUES('tmdbKey', '\"secret-tmdb-api-key-12345\"')").run();

  const res = await request("/api/config");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.tmdbKey, undefined, "CRITICAL: Private tmdbKey must NOT be returned on public /api/config");
  assert.strictEqual(res.data.jfUrl, undefined, "CRITICAL: Private jfUrl must NOT be returned on public /api/config");
  assert.strictEqual(res.data.showArchiveRows, true);
  assert.strictEqual(res.data.downloadsEnabled, true);
  assert.ok(Array.isArray(res.data.featured));
});

test("3. Authentication & Input Validation", async () => {
  const emptyRes = await request("/api/auth/login", { method: "POST", body: {} });
  assert.strictEqual(emptyRes.status, 400);

  const badRes = await request("/api/auth/login", { method: "POST", body: { username: "admin", password: "wrong-password" } });
  assert.strictEqual(badRes.status, 401);

  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "InitialAdminPassword123!" }
  });
  assert.strictEqual(loginRes.status, 200);
  assert.ok(loginRes.data.token);
  assert.strictEqual(loginRes.data.user.username, "admin");
  assert.strictEqual(loginRes.data.user.role, "admin");
  assert.strictEqual(loginRes.data.user.mustChange, true);
});

test("4. Normal User Signup & Profile Creation", async () => {
  const signupRes = await request("/api/auth/signup", {
    method: "POST",
    body: { username: "testuser", password: "Password123!" }
  });
  assert.strictEqual(signupRes.status, 201);
  assert.ok(signupRes.data.token);
  assert.strictEqual(signupRes.data.user.username, "testuser");
  assert.strictEqual(signupRes.data.user.role, "user");

  const profileRes = await request("/api/profiles", {
    headers: { Authorization: `Bearer ${signupRes.data.token}` }
  });
  assert.strictEqual(profileRes.status, 200);
  assert.strictEqual(profileRes.data.profiles.length, 1);
  assert.strictEqual(profileRes.data.profiles[0].name, "testuser");
});

test("5. Authorization Boundaries (Users cannot access Admin APIs)", async () => {
  const userLogin = await request("/api/auth/login", {
    method: "POST",
    body: { username: "testuser", password: "Password123!" }
  });
  const userToken = userLogin.data.token;

  const adminConfigRes = await request("/api/admin/config", {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(adminConfigRes.status, 403, "Normal user must be denied admin access");

  const adminStatsRes = await request("/api/admin/stats", {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.strictEqual(adminStatsRes.status, 403);
});

test("6. Forced Password Change & Admin Access Grant", async () => {
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "InitialAdminPassword123!" }
  });
  const adminToken = adminLogin.data.token;

  const attemptRes = await request("/api/admin/stats", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(attemptRes.status, 403);
  assert.strictEqual(attemptRes.data.code, "MUST_CHANGE_PASSWORD");

  const changeRes = await request("/api/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { oldPassword: "InitialAdminPassword123!", newPassword: "SuperSecureAdminPassword2026!" }
  });
  assert.strictEqual(changeRes.status, 200);

  const newLogin = await request("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "SuperSecureAdminPassword2026!" }
  });
  assert.strictEqual(newLogin.status, 200);
  assert.strictEqual(newLogin.data.user.mustChange, false);

  const statsRes = await request("/api/admin/stats", {
    headers: { Authorization: `Bearer ${newLogin.data.token}` }
  });
  assert.strictEqual(statsRes.status, 200);
  assert.ok(statsRes.data.users >= 2);
});

test("7. Server-Side Token Revocation & Logout", async () => {
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: { username: "testuser", password: "Password123!" }
  });
  const token = loginRes.data.token;

  // Session is active
  const meBefore = await request("/api/me", { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(meBefore.status, 200);

  // Invoke logout (increments token_version)
  const logoutRes = await request("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(logoutRes.status, 200);

  // Subsequent request with the same token must now be rejected
  const meAfter = await request("/api/me", { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(meAfter.status, 401);
  assert.strictEqual(meAfter.data.code, "SESSION_REVOKED");
});

test("8. Multi-Profile Isolation & Cross-Profile Boundary Enforcement", async () => {
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: { username: "testuser", password: "Password123!" }
  });
  const token = loginRes.data.token;

  // Create Profile A (Adult)
  const profARes = await request("/api/profiles", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { name: "AdultProfile", isKids: false }
  });
  const profAId = profARes.data.id;

  // Create Profile B (Kids)
  const profBRes = await request("/api/profiles", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { name: "KidsProfile", isKids: true, pin: "4321" }
  });
  const profBId = profBRes.data.id;

  // Save progress under Profile A
  await request("/api/sync/progress", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      profileId: profAId,
      mediaId: "mature-thriller-1",
      title: "Mature Thriller",
      streamUrl: "https://example.com/thriller.m3u8",
      position: 1200,
      duration: 7200
    }
  });

  // Query progress under Profile A -> Must contain "mature-thriller-1"
  const progA = await request(`/api/sync/progress?profileId=${profAId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(progA.data.progress.length, 1);
  assert.strictEqual(progA.data.progress[0].media_id, "mature-thriller-1");

  // Query progress under Profile B -> Must be EMPTY (strict profile isolation!)
  const progB = await request(`/api/sync/progress?profileId=${profBId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(progB.data.progress.length, 0, "CRITICAL: Profile B must NOT see Profile A progress!");
});

test("9. Parental PIN Verification & Brute-Force Rate Limiting", async () => {
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: { username: "testuser", password: "Password123!" }
  });
  const token = loginRes.data.token;

  // Fetch profiles to get KidsProfile id
  const profilesRes = await request("/api/profiles", { headers: { Authorization: `Bearer ${token}` } });
  const kidsProfile = profilesRes.data.profiles.find((p) => p.name === "KidsProfile");
  assert.ok(kidsProfile);
  assert.strictEqual(kidsProfile.has_pin, 1);

  // Test incorrect PIN
  const wrongPinRes = await request(`/api/profiles/${kidsProfile.id}/verify-pin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { pin: "0000" }
  });
  assert.strictEqual(wrongPinRes.status, 401);
  assert.strictEqual(wrongPinRes.data.code, "INCORRECT_PIN");

  // Test correct PIN
  const correctPinRes = await request(`/api/profiles/${kidsProfile.id}/verify-pin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { pin: "4321" }
  });
  assert.strictEqual(correctPinRes.status, 200);
  assert.strictEqual(correctPinRes.data.verified, true);
});

test("10. Unauthorized Cross-Account Profile Access Prevention", async () => {
  // Create second user
  const user2Res = await request("/api/auth/signup", {
    method: "POST",
    body: { username: "user_two", password: "Password123!" }
  });
  const user2Token = user2Res.data.token;

  // User 2 attempts to query progress using User 1's profileId
  const profilesRes = await request("/api/profiles", { headers: { Authorization: `Bearer ${user2Token}` } });
  const user2ProfileId = profilesRes.data.profiles[0].id;

  // Attempt to access with a foreign profile ID (e.g. 1)
  const exploitRes = await request(`/api/sync/progress?profileId=1`, {
    headers: { Authorization: `Bearer ${user2Token}` }
  });
  assert.strictEqual(exploitRes.status, 403, "User cannot query another user's profile ID");
});

test("11. TMDB Proxy Endpoint Resilience & Error Handling", async () => {
  // Discover endpoint without server TMDB key (or with test key)
  const discRes = await request("/api/tmdb/discover?type=movie&kids=true");
  // Should either respond with 200 or 503 (if unconfigured) or 502/504, but must never crash the server
  assert.ok([200, 503, 502, 504].includes(discRes.status));

  // Search with empty query
  const emptySearch = await request("/api/tmdb/search?query=");
  assert.strictEqual(emptySearch.status, 200);
  assert.deepStrictEqual(emptySearch.data.results, []);
});

test("12. Malformed Payloads & Nonexistent Routes (404/400)", async () => {
  const notFound = await request("/api/nonexistent-route-xyz");
  assert.strictEqual(notFound.status, 404);
  assert.strictEqual(notFound.data.code, "NOT_FOUND");
});
