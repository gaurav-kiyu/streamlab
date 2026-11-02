# STREAMLAB v1.2.0 — PHASE 22.6
# TMDB SERVER PROXY DEFECT REMEDIATION REPORT

**Authority:** Principal Software Architect / DevSecOps Lead / Application Security Lead  
**Date:** November 2, 2026  
**Status:** REMEDIATED, TESTED & CERTIFIED  
**Branch:** `fix/phase-21-tmdb-proxy-routing` (Merged to `release/v1.2.0-phase-21-sync`)  
**Commit:** `771b468`  

---

## 1. DEFECT IDENTIFICATION & ROOT CAUSE ANALYSIS

### 1.1 The Symptom
During Phase 21 independent review, inspection of `mobile/src/tmdb.js` revealed that when the mobile application operates in **Server Proxy Mode** (i.e., when no private TMDB API key is stored on the client device), non-discover requests failed to retrieve valid movie details, similar titles, or watch provider listings.

### 1.2 The Root Cause
Lines 34–36 of the legacy `mobile/src/tmdb.js` implemented a simplistic binary path router:
```javascript
// LEGACY DEFECTIVE ROUTING LOGIC:
const proxyUrl = path.startsWith("/discover")
  ? `${base}/api/tmdb/discover?${path.split("?")[1] || ""}`
  : `${base}/api/tmdb/search?${path.split("?")[1] || ""}`;
```
Consequently:
* Movie details requests (`/movie/:id?append_to_response=credits`) were routed to `/api/tmdb/search`.
* TV details requests (`/tv/:id?append_to_response=credits`) were routed to `/api/tmdb/search`.
* Similar titles requests (`/movie/:id/similar`) were routed to `/api/tmdb/search`.
* Watch provider requests (`/movie/:id/watch/providers`) were routed to `/api/tmdb/search`.

Because the server's `/api/tmdb/search` endpoint required a `query` parameter and only executed upstream movie keyword searches, all details and provider lookups returned empty `{ results: [] }` arrays or 400 errors.

---

## 2. SERVER-SIDE REMEDIATION ARCHITECTURE

In `server/server.js` and root `server.js`, StreamLab now exposes eight explicit, typed, allowlisted endpoints protected by input validation, SSRF guards, timeouts, and bounded caching:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ALLOWLISTED TMDB PROXY ENDPOINTS                     │
├───────────────────────────────────┬───────────────┬────────────────────┤
│ Route Pattern                     │ Upstream TMDB │ Allowed Parameters │
├───────────────────────────────────┼───────────────┼────────────────────┤
│ GET /api/tmdb/discover            │ /discover/... │ type, with_*, sort │
│ GET /api/tmdb/search              │ /search/...   │ query, type, region│
│ GET /api/tmdb/movie/:id           │ /movie/{id}   │ append_to_response │
│ GET /api/tmdb/tv/:id              │ /tv/{id}      │ append_to_response │
│ GET /api/tmdb/movie/:id/similar   │ /movie/{id}/..│ page, language     │
│ GET /api/tmdb/tv/:id/similar      │ /tv/{id}/..   │ page, language     │
│ GET /api/tmdb/movie/:id/watch-prov│ /movie/{id}/..│ language           │
│ GET /api/tmdb/tv/:id/watch-prov   │ /tv/{id}/..   │ language           │
└───────────────────────────────────┴───────────────┴────────────────────┘
```

### 2.1 Numeric ID Validation Guard
All parameterized ID endpoints strictly enforce integer validation:
```javascript
function validateTmdbId(id) {
  if (!id || !/^\d+$/.test(String(id).trim())) {
    throw err("Invalid TMDB ID: must be a positive integer", 400, "INVALID_TMDB_ID");
  }
  return String(id).trim();
}
```
Any non-numeric ID (e.g., path traversal attempts, SQL injection probes, or malformed strings) is rejected with `400 Bad Request (INVALID_TMDB_ID)` before any upstream dispatch.

### 2.2 Query Parameter Allowlisting
Endpoints reject or strip arbitrary parameters to prevent upstream injection. Only legitimate query keys defined in `ALLOWED_DISCOVER_PARAMS`, `ALLOWED_SEARCH_PARAMS`, and sanitized `append_to_response` values (`credits,videos,images,similar,watch/providers`) are forwarded.

### 2.3 Bounded In-Memory LRU Cache
A custom `BoundedCache` instance prevents memory exhaustion:
* Bounded to 500 entries.
* 15-minute TTL ($900,000\text{ ms}$).
* Evicts oldest entry upon reaching capacity ceiling.

---

## 3. CLIENT-SIDE REMEDIATION ARCHITECTURE

In `mobile/src/tmdb.js`, the routing logic was extracted into a dedicated, unit-testable mapper `mapTmdbPathToProxy(path, base)`:
* Explicitly transforms `/discover/movie` and `/discover/tv` to `/api/tmdb/discover?type=movie|tv`.
* Explicitly transforms `/search/movie`, `/search/tv`, and `/search/multi` to `/api/tmdb/search?type=...`.
* Maps `/:kind/:id` to `/api/tmdb/:kind/:id`.
* Maps `/:kind/:id/similar` to `/api/tmdb/:kind/:id/similar`.
* Maps `/:kind/:id/watch/providers` to `/api/tmdb/:kind/:id/watch-providers`.
* Returns `null` for unmapped or unauthorized paths, preventing arbitrary endpoint proxying.

---

## 4. VERIFICATION & TEST RESULTS

### 4.1 Server Test Suite (`server/test/tmdb-proxy.test.js`)
* **Test 1:** Unconfigured server returns 503 `TMDB_NOT_CONFIGURED` across all 8 endpoints — **PASS**
* **Test 2:** Empty search query returns 200 with `{ results: [] }` — **PASS**
* **Test 3:** Non-numeric TMDB IDs rejected with 400 `INVALID_TMDB_ID` — **PASS**
* **Test 4:** Upstream requests dispatch with sanitized params and bounded cache hits — **PASS**

### 4.2 Mobile Test Suite (`mobile/test/tmdb-proxy-client.test.js`)
* **Test 1:** Discover paths map with explicit `type` parameter — **PASS**
* **Test 2:** Search paths map with explicit media type (`movie`, `tv`, `multi`) — **PASS**
* **Test 3:** Details & append_to_response map to dedicated ID routes — **PASS**
* **Test 4:** Similar content maps to dedicated routes — **PASS**
* **Test 5:** Watch provider routes map to kebab-case `watch-providers` — **PASS**
* **Test 6:** Unallowlisted arbitrary paths return `null` (SSRF prevention) — **PASS**
