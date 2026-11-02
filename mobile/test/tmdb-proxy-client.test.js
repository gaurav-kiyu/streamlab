import test from "node:test";
import assert from "node:assert";

import { mapTmdbPathToProxy } from "../src/tmdb.js";

test("TMDB Client Proxy 1: Discover Paths Map with Explicit Type Parameter", () => {
  const base = "http://10.0.2.2:3000";

  const movieUrl = mapTmdbPathToProxy("/discover/movie?with_original_language=hi&region=IN", base);
  assert.strictEqual(
    movieUrl,
    "http://10.0.2.2:3000/api/tmdb/discover?with_original_language=hi&region=IN&type=movie"
  );

  const tvUrl = mapTmdbPathToProxy("/discover/tv?with_original_language=ta", base);
  assert.strictEqual(
    tvUrl,
    "http://10.0.2.2:3000/api/tmdb/discover?with_original_language=ta&type=tv"
  );
});

test("TMDB Client Proxy 2: Search Paths Map with Explicit Media Type", () => {
  const base = "https://streamlab.example.com";

  const movieSearch = mapTmdbPathToProxy("/search/movie?query=RRR&region=IN", base);
  assert.strictEqual(
    movieSearch,
    "https://streamlab.example.com/api/tmdb/search?query=RRR&region=IN&type=movie"
  );

  const tvSearch = mapTmdbPathToProxy("/search/tv?query=Panchayat", base);
  assert.strictEqual(
    tvSearch,
    "https://streamlab.example.com/api/tmdb/search?query=Panchayat&type=tv"
  );

  const multiSearch = mapTmdbPathToProxy("/search/multi?query=Kantara", base);
  assert.strictEqual(
    multiSearch,
    "https://streamlab.example.com/api/tmdb/search?query=Kantara&type=multi"
  );
});

test("TMDB Client Proxy 3: Details & Append-To-Response Map to Dedicated ID Routes", () => {
  const base = "http://127.0.0.1:3000/";

  const movieDetails = mapTmdbPathToProxy("/movie/550?append_to_response=credits", base);
  assert.strictEqual(
    movieDetails,
    "http://127.0.0.1:3000/api/tmdb/movie/550?append_to_response=credits"
  );

  const tvDetails = mapTmdbPathToProxy("/tv/1399?append_to_response=credits", base);
  assert.strictEqual(
    tvDetails,
    "http://127.0.0.1:3000/api/tmdb/tv/1399?append_to_response=credits"
  );
});

test("TMDB Client Proxy 4: Similar Content Maps to Dedicated Routes", () => {
  const base = "http://10.0.2.2:3000";

  const movieSimilar = mapTmdbPathToProxy("/movie/550/similar", base);
  assert.strictEqual(
    movieSimilar,
    "http://10.0.2.2:3000/api/tmdb/movie/550/similar"
  );

  const tvSimilar = mapTmdbPathToProxy("/tv/1399/similar?page=2", base);
  assert.strictEqual(
    tvSimilar,
    "http://10.0.2.2:3000/api/tmdb/tv/1399/similar?page=2"
  );
});

test("TMDB Client Proxy 5: Watch Provider Routes Map to kebab-case watch-providers", () => {
  const base = "http://10.0.2.2:3000";

  const movieProviders = mapTmdbPathToProxy("/movie/550/watch/providers", base);
  assert.strictEqual(
    movieProviders,
    "http://10.0.2.2:3000/api/tmdb/movie/550/watch-providers"
  );

  const tvProviders = mapTmdbPathToProxy("/tv/1399/watch/providers", base);
  assert.strictEqual(
    tvProviders,
    "http://10.0.2.2:3000/api/tmdb/tv/1399/watch-providers"
  );
});

test("TMDB Client Proxy 6: Unallowlisted Arbitrary Paths Return Null (SSRF Prevention)", () => {
  const base = "http://10.0.2.2:3000";

  assert.strictEqual(mapTmdbPathToProxy("/arbitrary/endpoint", base), null);
  assert.strictEqual(mapTmdbPathToProxy("/authentication/token/new", base), null);
  assert.strictEqual(mapTmdbPathToProxy("/account/123/watchlist", base), null);
  assert.strictEqual(mapTmdbPathToProxy(null, base), null);
  assert.strictEqual(mapTmdbPathToProxy("", base), null);
});
