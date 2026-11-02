"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const TEST_DB = path.join(__dirname, "test-tmdb-data.db");
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
process.env.DB_FILE = TEST_DB;
process.env.JWT_SECRET = "streamlab-super-secure-test-jwt-secret-key-32chars";

const { app, db } = require("../server");

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

async function request(reqPath, options = {}) {
  const res = await fetch(`${baseUrl}${reqPath}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

test("TMDB Proxy 1: Unconfigured Server Returns 503 Across All Endpoints", async () => {
  // Ensure no TMDB key is set
  db.prepare("DELETE FROM config WHERE key='tmdbKey'").run();
  delete process.env.TMDB_API_KEY;

  const endpoints = [
    "/api/tmdb/discover?type=movie",
    "/api/tmdb/discover?type=tv",
    "/api/tmdb/search?query=Inception",
    "/api/tmdb/movie/550",
    "/api/tmdb/tv/1399",
    "/api/tmdb/movie/550/similar",
    "/api/tmdb/tv/1399/similar",
    "/api/tmdb/movie/550/watch-providers",
    "/api/tmdb/tv/1399/watch-providers"
  ];

  for (const ep of endpoints) {
    const res = await request(ep);
    assert.strictEqual(res.status, 503, `Expected 503 for ${ep}, got ${res.status}`);
    assert.strictEqual(res.data.code, "TMDB_NOT_CONFIGURED");
  }
});

test("TMDB Proxy 2: Empty Search Query Responds 200 with Empty Results", async () => {
  const emptyRes1 = await request("/api/tmdb/search");
  assert.strictEqual(emptyRes1.status, 200);
  assert.deepStrictEqual(emptyRes1.data.results, []);

  const emptyRes2 = await request("/api/tmdb/search?query=   ");
  assert.strictEqual(emptyRes2.status, 200);
  assert.deepStrictEqual(emptyRes2.data.results, []);
});

test("TMDB Proxy 3: Non-Numeric TMDB IDs are Strictly Rejected (400 INVALID_TMDB_ID)", async () => {
  const invalidPaths = [
    "/api/tmdb/movie/invalid",
    "/api/tmdb/movie/-123",
    "/api/tmdb/movie/12.34",
    "/api/tmdb/tv/not_an_id",
    "/api/tmdb/movie/abc/similar",
    "/api/tmdb/tv/xyz/similar",
    "/api/tmdb/movie/hack_sqli/watch-providers",
    "/api/tmdb/tv/undefined/watch-providers"
  ];

  for (const p of invalidPaths) {
    const res = await request(p);
    assert.strictEqual(res.status, 400, `Expected 400 for ${p}, got ${res.status}`);
    assert.strictEqual(res.data.code, "INVALID_TMDB_ID");
  }
});

test("TMDB Proxy 4: Upstream Request Dispatches with Sanitized Params and Bounded Caching", async () => {
  // Configure mock key in database
  db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('tmdbKey', '\"mock-key-abc\"')").run();

  const originalFetch = global.fetch;
  const calls = [];

  try {
    global.fetch = async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("api.themoviedb.org")) {
        calls.push({ url: urlStr, opts });
        return {
          ok: true,
          status: 200,
          json: async () => ({ mock: true, url: urlStr, results: [{ id: 100, title: "Mock Title" }] })
        };
      }
      return originalFetch(url, opts);
    };

    // Test 1: Discover endpoint filters out unknown parameters
    const discRes = await request("/api/tmdb/discover?type=movie&sort_by=popularity.desc&evil_param=hack&page=1");
    assert.strictEqual(discRes.status, 200);
    assert.strictEqual(calls.length, 1);
    const call1 = calls[0].url;
    assert.ok(call1.includes("/discover/movie"));
    assert.ok(call1.includes("sort_by=popularity.desc"));
    assert.ok(call1.includes("api_key=mock-key-abc"));
    assert.ok(!call1.includes("evil_param"), "Disallowed param must be stripped");

    // Test 2: Caching - identical request returns cached result without second upstream call
    const cachedRes = await request("/api/tmdb/discover?type=movie&sort_by=popularity.desc&page=1");
    assert.strictEqual(cachedRes.status, 200);
    assert.strictEqual(calls.length, 1, "Cached call must not trigger upstream fetch");

    // Test 3: Movie Details with sanitized append_to_response
    const movieRes = await request("/api/tmdb/movie/999?append_to_response=credits,malicious_token");
    assert.strictEqual(movieRes.status, 200);
    assert.strictEqual(calls.length, 2);
    const call2 = calls[1].url;
    assert.ok(call2.includes("/movie/999"));
    assert.ok(call2.includes("append_to_response=credits"));
    assert.ok(!call2.includes("malicious_token"));

    // Test 4: Movie Similar
    const similarRes = await request("/api/tmdb/movie/999/similar");
    assert.strictEqual(similarRes.status, 200);
    assert.strictEqual(calls.length, 3);
    assert.ok(calls[2].url.includes("/movie/999/similar"));

    // Test 5: Watch Providers
    const provRes = await request("/api/tmdb/movie/999/watch-providers");
    assert.strictEqual(provRes.status, 200);
    assert.strictEqual(calls.length, 4);
    assert.ok(calls[3].url.includes("/movie/999/watch/providers"));

  } finally {
    global.fetch = originalFetch;
    db.prepare("DELETE FROM config WHERE key='tmdbKey'").run();
  }
});
