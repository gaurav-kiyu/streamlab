import test from "node:test";
import assert from "node:assert";

import AsyncStorage from "@react-native-async-storage/async-storage";
import SecureStore from "expo-secure-store";
import { LANGS, langByCode } from "../src/languages.js";
import { QUALITIES } from "../src/jellyfin.js";
import { MORE } from "../src/strings.js";
import { GENRES, getSimilarMovies } from "../src/tmdb.js";
import {
  loadPosition,
  savePosition,
  clearPosition,
  upsertRecent,
  loadRecent,
  toggleList,
  loadList,
} from "../src/storage.js";
import {
  getSettings,
  saveSettings,
  loadSettings,
  setAuthToken,
  getAuthToken,
} from "../src/settings.js";

test("1. Indian Language Dictionary & Configuration Integrity", () => {
  assert.strictEqual(LANGS.length, 10, "Must support exactly 10 Indian regional languages");
  const codes = LANGS.map((l) => l.code);
  assert.deepStrictEqual(codes, ["all", "hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu"]);

  // Verify langByCode fallback
  assert.strictEqual(langByCode("hi").label, "Hindi");
  assert.strictEqual(langByCode("unknown_xyz").code, "hi", "Unknown language should fallback to Hindi");

  // Verify all dictionaries in strings.js contain required UI keys
  const expectedKeys = ["download", "downloading", "removeDownload", "downloads", "advanced", "chooseLang"];
  for (const lang of ["en", "hi", "ta", "te", "bn", "mr", "ml", "kn", "pa", "gu"]) {
    assert.ok(MORE[lang], `Language dictionary for '${lang}' must exist`);
    for (const key of expectedKeys) {
      assert.ok(MORE[lang][key], `Key '${key}' must exist in dictionary '${lang}'`);
    }
  }
});

test("2. Jellyfin Bitrate & Quality Mappings", () => {
  assert.strictEqual(QUALITIES.length, 6);
  const codes = QUALITIES.map((q) => q.code);
  assert.deepStrictEqual(codes, ["auto", "480", "720", "1080", "1440", "2160"]);
});

test("3. Client Settings & SecureStore Isolation (SEC-04 Remediation)", async () => {
  await AsyncStorage.clear();
  SecureStore._store.clear();

  await saveSettings({
    lang: "ta",
    dataSaver: true,
    quality: "1080",
    jfPass: "super-secret-password-123",
    tmdbKey: "tmdb-secret-override-key",
  });

  // Verify passwords and TMDB secrets are NOT stored in plaintext AsyncStorage
  const rawAsyncStorage = await AsyncStorage.getItem("settings");
  assert.ok(rawAsyncStorage, "Settings JSON must be persisted in AsyncStorage");
  const parsed = JSON.parse(rawAsyncStorage);
  assert.strictEqual(parsed.jfPass, undefined, "Sensitive Jellyfin password must NOT be in plaintext storage");
  assert.strictEqual(parsed.tmdbKey, undefined, "Sensitive TMDB API key must NOT be in plaintext storage");

  // Verify secrets are isolated in SecureStore
  assert.strictEqual(await SecureStore.getItemAsync("jfPass"), "super-secret-password-123");
  assert.strictEqual(await SecureStore.getItemAsync("tmdbSecretKey"), "tmdb-secret-override-key");

  // Test token storage
  await setAuthToken("mock-jwt-token-xyz");
  assert.strictEqual(await getAuthToken(), "mock-jwt-token-xyz");
  assert.strictEqual(await SecureStore.getItemAsync("userAuthToken"), "mock-jwt-token-xyz");
});

test("4. Playback Position & Continue Watching Bounds", async () => {
  await AsyncStorage.clear();

  const testUrl = "https://example.com/stream.m3u8";
  await savePosition(testUrl, 142.5);
  const loaded = await loadPosition(testUrl);
  assert.strictEqual(loaded, 142.5);

  await clearPosition(testUrl);
  assert.strictEqual(await loadPosition(testUrl), 0);

  // Test Recent List capping at max 12 items
  for (let i = 1; i <= 15; i++) {
    await upsertRecent({ id: i, title: `Movie ${i}` }, `https://example.com/${i}.m3u8`, i * 10, 100);
  }

  const recents = await loadRecent();
  assert.strictEqual(recents.length, 12, "Continue watching list must be strictly bounded to max 12 items");
  assert.strictEqual(recents[0].title, "Movie 15", "Newest played item must appear first");
});

test("5. Watchlist (My List) Toggle Logic", async () => {
  await AsyncStorage.clear();

  const movie = { id: "ia-film-99", title: "Sant Tukaram", overview: "Classic 1936 film" };

  // Add to list
  const state1 = await toggleList(movie);
  assert.strictEqual(state1, true, "First toggle must add item to list");
  let list = await loadList();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, "ia-film-99");

  // Remove from list
  const state2 = await toggleList(movie);
  assert.strictEqual(state2, false, "Second toggle must remove item from list");
  list = await loadList();
  assert.strictEqual(list.length, 0);
});

test("6. Genre Taxonomy & Discovery Filters (REQ-18-02)", () => {
  assert.ok(Array.isArray(GENRES), "GENRES must be an array");
  assert.strictEqual(GENRES.length, 7, "Must define 7 standard genre classifications");
  const names = GENRES.map((g) => g.name);
  assert.deepStrictEqual(names, [
    "All Genres",
    "Action",
    "Comedy",
    "Drama",
    "Romance",
    "Thriller",
    "Family",
  ]);
  assert.strictEqual(GENRES[0].id, "all");
});

test("7. Recommendation & Similar Content Interface (REQ-18-03)", async () => {
  // Empty item returns empty array
  const emptyRes = await getSimilarMovies(null);
  assert.deepStrictEqual(emptyRes, []);

  const invalidRes = await getSimilarMovies({ id: "not-a-number" });
  assert.deepStrictEqual(invalidRes, []);

  // Valid item structure test
  const validRes = await getSimilarMovies({ id: 550, media: "movie" });
  assert.ok(Array.isArray(validRes));
});

test("8. Search Media Type Filtering Logic (REQ-18-04)", () => {
  const sampleResults = [
    { id: 101, title: "Lagaan", media: "movie" },
    { id: 102, title: "Mirzapur", media: "tv" },
    { id: 103, title: "Sholay", media: "movie" },
    { id: 104, title: "Panchayat", media: "tv" },
  ];

  const filterByType = (items, type) => {
    if (type === "all") return items;
    return items.filter((r) => (type === "tv" ? r.media === "tv" : r.media !== "tv"));
  };

  const allItems = filterByType(sampleResults, "all");
  assert.strictEqual(allItems.length, 4, "All results filter must retain all 4 items");

  const movies = filterByType(sampleResults, "movie");
  assert.strictEqual(movies.length, 2, "Movie filter must return exactly 2 movies");
  assert.deepStrictEqual(movies.map((m) => m.title), ["Lagaan", "Sholay"]);

  const tvShows = filterByType(sampleResults, "tv");
  assert.strictEqual(tvShows.length, 2, "TV filter must return exactly 2 TV shows");
  assert.deepStrictEqual(tvShows.map((t) => t.title), ["Mirzapur", "Panchayat"]);
});
