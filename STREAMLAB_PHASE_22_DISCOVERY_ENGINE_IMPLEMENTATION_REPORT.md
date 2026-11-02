# STREAMLAB v1.2.0 — PHASE 22.4
# INDIA-FIRST DISCOVERY ENGINE IMPLEMENTATION REPORT

**Authority:** Principal Software Architect / Product Engineering Lead / Media Streaming Engineer  
**Date:** November 2, 2026  
**Status:** IMPLEMENTED, TESTED & CERTIFIED  
**Application:** StreamLab v1.2.0 (`com.streamlab.app`)  

---

## 1. ARCHITECTURAL OVERVIEW

The StreamLab Discovery Engine was comprehensively redesigned in Phase 22 to establish an **India-First, Multi-Language, Multi-OTT Discovery Pipeline**. The architecture bridges the mobile client (`mobile/src/tmdb.js`, `languages.js`, `providers.js`, `Browse.js`, `Search.js`, `Details.js`) with an allowlisted, rate-limited, and cached server proxy (`server/server.js`).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INDIA-FIRST DISCOVERY ENGINE TOPOLOGY                           │
│                                                                                        │
│   [Mobile Browse / Search] ──────> [mobile/src/tmdb.js]                                │
│                                             │                                          │
│                                             ├── Client Key Mode ──> [TMDB v3 API]      │
│                                             │                                          │
│                                             └── Server Proxy Mode                       │
│                                                       │                                │
│                                             [server.js Allowlist]                      │
│                                                       │                                │
│                                         [Bounded LRU Cache (500)]                      │
│                                                       │                                │
│                                             [TMDB Upstream / IN]                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MODIFIED & CREATED ARTIFACTS INVENTORY

| Component / File | Nature | Key Responsibilities Added |
| :--- | :---: | :--- |
| **`mobile/src/providers.js`** | **NEW** | Registry of 14 Indian OTT platforms, monetization categories, deep-link schemes, and URL security validator. |
| **`mobile/src/languages.js`** | Modified | Added Assamese (`as`) and Odia (`or`) to `INDIAN_CONTENT_LANGUAGES`; implemented `getVerifiedAudioInfo` & `getVerifiedSubtitleInfo`. |
| **`mobile/src/tmdb.js`** | Modified | Implemented `ALL_INDIAN_LANG_QUERY`, `loadIndiaFirstShelves`, `loadByProvider`, `deduplicateTitles`, multi-type search, and `ATTRIBUTION`. |
| **`mobile/src/screens/Browse.js`**| Modified | India-first Hero header, 11-language filter chips, OTT platform filter bar, content badges (`FREE`, `SERIES`), attribution footer. |
| **`mobile/src/screens/Search.js`**| Modified | Multi-media search across movies and TV series; deduplicated results; media type filtering. |
| **`mobile/src/screens/Details.js`**| Modified | Verified audio/subtitle badge; Category 1 (Direct Play) vs Category 2 (OTT Handoff); interactive provider pills; attribution. |
| **`server/server.js`** | Modified | Explicit allowlisted endpoints for Discover, Search, Movie/TV Details, Similar, and Watch Providers with LRU cache. |

---

## 3. QUERY PARAMETER MECHANICS & TMDB SPECIFICATION

### 3.1 Pan-Indian Multi-Language Queries
TMDB discover endpoints accept pipe-separated (`|`) strings representing logical **OR** operations for `with_original_language`. StreamLab aggregates all 11 recognized regional film languages into a single query constant:

$$\text{ALL\_INDIAN\_LANG\_QUERY} = \text{"hi|ta|te|ml|kn|bn|mr|pa|gu|as|or"}$$

* **Trending Indian Movies:**
  `/discover/movie?with_original_language=hi|ta|te|ml|kn|bn|mr|pa|gu|as|or&region=IN&sort_by=popularity.desc`
* **Trending Indian Series:**
  `/discover/tv?with_original_language=hi|ta|te|ml|kn|bn|mr|pa|gu|as|or&sort_by=popularity.desc`

### 3.2 Provider Availability & Monetization
When filtering by OTT streaming provider, StreamLab queries TMDB Watch Provider endpoints using the Indian market context:
* `watch_region=IN`
* `with_watch_providers={providerTmdbId}` (e.g., `122` for JioHotstar, `119` for Prime Video, `8` for Netflix)
* `with_watch_monetization_types={flatrate|free|ads|rent}`

---

## 4. DEDUPLICATION & STABILITY ENGINE

To prevent duplicate entries when aggregating multi-provider and regional lists, `deduplicateTitles` enforces a composite identity key:

$$\text{Key} = \text{Media Type} + \text{":"} + \text{TMDB ID}$$

If an item shares the same TMDB ID and media type as an existing item in the array, subsequent duplicates are filtered out, ensuring a stable, deterministic grid rendering.

---

## 5. BOUNDED IN-MEMORY CACHE SPECIFICATION

To guarantee sub-millisecond local responses and prevent backend memory exhaustion (OOM):
* **Class:** `BoundedCache` (LRU-style eviction).
* **Maximum Entries:** 500 cached requests.
* **TTL:** 15 minutes ($900,000\text{ ms}$).
* **Key Format:** `upstreamPath + "?" + sanitizedParams`.
* **Eviction Strategy:** When size reaches 500, the oldest inserted key is evicted (`cache.keys().next().value`).

---

## 6. TMDB & JUSTWATCH ATTRIBUTION COMPLIANCE

In strict accordance with TMDB and JustWatch partner guidelines, StreamLab displays mandatory attribution notices across the Browse and Details surfaces:
1. **TMDB Notice:** *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
2. **JustWatch Notice:** *"Streaming availability data powered by JustWatch."*
