import test from "node:test";
import assert from "node:assert";

import {
  LANGS,
  INDIAN_CONTENT_LANGUAGES,
  langByCode,
  contentLangByCode,
  getVerifiedAudioInfo,
  getVerifiedSubtitleInfo,
} from "../src/languages.js";

import {
  INDIAN_PROVIDERS,
  MONETIZATION_TYPES,
  validateExternalUrl,
  findProvider,
  resolveProviderHandoffUrl,
} from "../src/providers.js";

import {
  ALL_INDIAN_LANG_QUERY,
  deduplicateTitles,
  ATTRIBUTION,
  loadIndiaFirstShelves,
} from "../src/tmdb.js";

test("India-First 1: Content Discovery Languages Include All 11 Required Languages + All India", () => {
  assert.strictEqual(INDIAN_CONTENT_LANGUAGES.length, 12);
  const codes = INDIAN_CONTENT_LANGUAGES.map((l) => l.code);
  const required = ["all", "hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu", "as", "or"];
  assert.deepStrictEqual(codes, required);

  // Verify Assamese and Odia configurations
  const as = contentLangByCode("as");
  assert.strictEqual(as.label, "Assamese");
  assert.strictEqual(as.native, "অসমীয়া");
  assert.strictEqual(as.tmdb, "as");

  const or = contentLangByCode("or");
  assert.strictEqual(or.label, "Odia");
  assert.strictEqual(or.native, "ଓଡ଼ିଆ");
  assert.strictEqual(or.tmdb, "or");

  // Verify All India combined pipe-separated query
  const all = contentLangByCode("all");
  assert.strictEqual(all.tmdb, ALL_INDIAN_LANG_QUERY);
  assert.strictEqual(all.tmdb, "hi|ta|te|ml|kn|bn|mr|pa|gu|as|or");
});

test("India-First 2: UI Languages Baseline Integrity Preserved (Zero UI Regression)", () => {
  // Preserves 10 items for existing UI language contract
  assert.strictEqual(LANGS.length, 10);
  assert.strictEqual(langByCode("hi").label, "Hindi");
  assert.strictEqual(langByCode("unknown_xyz").code, "hi", "Fallback to Hindi preserved");

  // Assamese and Odia resolution in langByCode
  assert.strictEqual(langByCode("as").label, "Assamese");
  assert.strictEqual(langByCode("or").label, "Odia");
});

test("India-First 3: Strict Audio & Subtitle Language Verification (No Unverified Dub Claims)", () => {
  // Case A: Telugu film with no verified dubbing data
  const teluguMovie = {
    id: 12345,
    title: "Pushpa: The Rise",
    original_language: "te",
  };
  const unverifiedAudio = getVerifiedAudioInfo(teluguMovie);
  assert.strictEqual(unverifiedAudio.verified, false);
  assert.strictEqual(unverifiedAudio.text, "Audio language information unavailable");

  const unverifiedSub = getVerifiedSubtitleInfo(teluguMovie);
  assert.strictEqual(unverifiedSub.verified, false);
  assert.strictEqual(unverifiedSub.text, "Subtitle information unavailable");

  // Case B: Verified audio tracks present
  const verifiedMovie = {
    id: 67890,
    title: "RRR",
    original_language: "te",
    audio_languages: ["Telugu (Original)", "Hindi", "Tamil", "Malayalam"],
    subtitle_languages: ["English", "Hindi"],
  };
  const verifiedAudio = getVerifiedAudioInfo(verifiedMovie);
  assert.strictEqual(verifiedAudio.verified, true);
  assert.deepStrictEqual(verifiedAudio.languages, ["Telugu (Original)", "Hindi", "Tamil", "Malayalam"]);

  const verifiedSub = getVerifiedSubtitleInfo(verifiedMovie);
  assert.strictEqual(verifiedSub.verified, true);
  assert.deepStrictEqual(verifiedSub.languages, ["English", "Hindi"]);
});

test("India-First 4: Indian OTT Providers Registry & Deep-Link Validation", () => {
  assert.ok(INDIAN_PROVIDERS.length >= 14, "Must register at least 14 Indian OTT providers");

  const providerIds = INDIAN_PROVIDERS.map((p) => p.id);
  const expected = [
    "jiohotstar",
    "prime",
    "netflix",
    "sonyliv",
    "zee5",
    "sunnxt",
    "aha",
    "hoichoi",
    "etvwin",
    "mxplayer",
    "manoramamax",
    "chaupal",
    "planetmarathi",
    "waves",
  ];
  for (const exp of expected) {
    assert.ok(providerIds.includes(exp), `Provider '${exp}' must exist in registry`);
  }

  // Find provider by ID, name, or TMDB ID
  assert.strictEqual(findProvider("jiohotstar").name, "JioHotstar");
  assert.strictEqual(findProvider("Prime Video").id, "prime");
  assert.strictEqual(findProvider("8").id, "netflix"); // Netflix TMDB ID 8
  assert.strictEqual(findProvider("237").id, "sonyliv"); // SonyLIV TMDB ID 237
  assert.strictEqual(findProvider("232").id, "zee5"); // ZEE5 TMDB ID 232
  assert.strictEqual(findProvider("waves").isPublicService, true);
});

test("India-First 5: External OTT Link Validation & Handoff Security", () => {
  // Allowed HTTPS and app schemes
  assert.strictEqual(validateExternalUrl("https://www.hotstar.com/in/movies/123"), true);
  assert.strictEqual(validateExternalUrl("https://www.primevideo.com/detail/xyz"), true);
  assert.strictEqual(validateExternalUrl("hotstar://movies/123"), true);
  assert.strictEqual(validateExternalUrl("primevideo://detail/xyz"), true);
  assert.strictEqual(validateExternalUrl("nflx://title/8000"), true);
  assert.strictEqual(validateExternalUrl("sonyliv://vod/456"), true);
  assert.strictEqual(validateExternalUrl("wavespb://live/1"), true);

  // Block disallowed / insecure schemes
  assert.strictEqual(validateExternalUrl("http://insecure.example.com"), false);
  assert.strictEqual(validateExternalUrl("javascript:alert(1)"), false);
  assert.strictEqual(validateExternalUrl("file:///data/local/tmp"), false);
  assert.strictEqual(validateExternalUrl("data:text/html,hack"), false);
  assert.strictEqual(validateExternalUrl(null), false);
  assert.strictEqual(validateExternalUrl(""), false);

  // Handoff URL Resolution
  const hotstarUrl = resolveProviderHandoffUrl("JioHotstar", null, "https://www.hotstar.com/in/movies/rrr");
  assert.strictEqual(hotstarUrl, "https://www.hotstar.com/in/movies/rrr");

  const fallbackUrl = resolveProviderHandoffUrl("aha", null, null);
  assert.strictEqual(fallbackUrl, "https://www.aha.video");
});

test("India-First 6: Duplicate Title Deduplication by ID and Media Type", () => {
  const duplicates = [
    { id: 101, title: "Kantara", media: "movie" },
    { id: 101, title: "Kantara", media: "movie" }, // Exact duplicate
    { id: 101, title: "Kantara", name: "Kantara", media: "tv" }, // Different media type (allowed)
    { id: 102, title: "Drishyam 2", media: "movie" },
  ];

  const deduplicated = deduplicateTitles(duplicates);
  assert.strictEqual(deduplicated.length, 3);
  assert.strictEqual(deduplicated[0].id, 101);
  assert.strictEqual(deduplicated[0].media, "movie");
  assert.strictEqual(deduplicated[1].id, 101);
  assert.strictEqual(deduplicated[1].media, "tv");
  assert.strictEqual(deduplicated[2].id, 102);
});

test("India-First 7: Mandatory TMDB and JustWatch Attributions Present", () => {
  assert.ok(ATTRIBUTION.tmdb.notice.includes("TMDB API"));
  assert.ok(ATTRIBUTION.tmdb.url.includes("themoviedb.org"));
  assert.ok(ATTRIBUTION.justWatch.notice.includes("JustWatch"));
  assert.ok(ATTRIBUTION.justWatch.url.includes("justwatch.com"));
});
