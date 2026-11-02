# STREAMLAB v1.2.0 — PHASE 18 IMPLEMENTATION PLAN

**Authority:** Principal Software Architect / Lead Release Engineer  
**Baseline Commit:** `aedd6efd7dd4cdfd528a29c05e7e9f6aff55dccc`  
**Phase 18 Branch:** `feat/phase-18-product-advancement`  
**Target Milestone:** StreamLab v1.2.0  
**Date:** 2026-11-01  

---

## 1. Implementation Principles & Governance Guardrails

1. **Strict Baseline Protection:** Frozen baseline `v1.0.0-rc1` (`b91e53e`) remains immutable. No rebasing or history rewriting.
2. **Security Preservation:** All authentication, profile isolation, SSRF defenses, and `isLive` playback contracts remain strictly enforced.
3. **Controlled Incremental Rollout:** Changes are implemented in small, testable increments, followed by regression execution at each step.
4. **Codebase Synchronization:** Because the monorepo provides root `src/` for standalone Expo CLI compatibility alongside `mobile/src/`, all mobile source modifications must remain 100% synchronized.
5. **Zero Breaking Changes:** Backward compatibility for all existing REST contracts and SQLite schemas must be maintained.

---

## 2. Phased Implementation Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: SECURITY HARDENING (REQ-18-01)                                      │
│ Update `server/src/livetv/epg-parser.js` with 16-byte tail buffer for       │
│ chunk-boundary DOCTYPE/ENTITY detection. Add unit test.                     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: OPERATIONAL OBSERVABILITY (REQ-18-05)                               │
│ Expand `/api/health` in `server/server.js` with structured memory (RSS,     │
│ heap) and SQLite database metrics. Update health endpoint unit test.        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: CONTENT DISCOVERY ENHANCEMENTS (REQ-18-02, REQ-18-03, REQ-18-04)   │
│ - `tmdb.js`: Add `getSimilarMovies(movieId)` and genre-filtered discovery.  │
│ - `Browse.js`: Add interactive Genre Chips with D-pad TV focusability.      │
│ - `Details.js`: Add "More Like This" recommendation shelf.                  │
│ - `Search.js`: Make trending chips interactive; add Movie/TV type toggle.   │
│ - Synchronize `src/` and `mobile/src/`.                                     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: MONOREPO VERSION ALIGNMENT (REQ-18-06)                              │
│ Update root, server, and mobile `package.json` from 0.2.0 to 1.2.0.         │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: AUTOMATED REGRESSION & VERIFICATION (REQ-18-07)                     │
│ Execute full monorepo test suite (`npm run test --workspaces --if-present`).│
│ Verify 0 regressions and 100% test pass rate across all suites.             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Work Breakdown & Acceptance Verification

### Step 1: Chunk-Boundary XXE Defense (`server/src/livetv/epg-parser.js`)
- **Action:** In `parseXmltvStream`, declare `let lastTail = ""` before stream data listener and buffer chunk loop. Check `/<(!DOCTYPE|!ENTITY)/i.test(lastTail + chunkStr)`. Save `lastTail = chunkStr.slice(-16)`.
- **Test:** Add Test 9 in `server/test/epg-streaming.test.js`: "EPG Streaming 9: Chunk-Boundary Split-Token XXE Detection".
- **Verification:** `node --test server/test/epg-streaming.test.js` passes 9/9 tests.

### Step 2: System Health Metrics (`server/server.js`)
- **Action:** Update `/api/health` handler:
  ```javascript
  const mem = process.memoryUsage();
  const dbSizeRow = db.prepare("PRAGMA page_count").get();
  const dbPageSize = db.prepare("PRAGMA page_size").get();
  res.json({
    ok: true,
    version: "1.2.0",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    database: {
      pages: dbSizeRow?.page_count || 0,
      pageSize: dbPageSize?.page_size || 4096,
      sizeKb: Math.round(((dbSizeRow?.page_count || 0) * (dbPageSize?.page_size || 4096)) / 1024)
    }
  });
  ```
- **Test:** Update test 1 in `server/test/server.test.js` to assert `data.memory` and `data.database` presence.

### Step 3: Mobile Discovery & Recommendations
- **Action in `mobile/src/tmdb.js`:** Add `getSimilarMovies(item)` function requesting `/movie/{id}/similar` via proxy/direct API.
- **Action in `mobile/src/screens/Browse.js`:** Add `GENRES` chip row below language selector; filter current rows when genre is selected.
- **Action in `mobile/src/screens/Details.js`:** Load similar items in `useEffect`; render a horizontal `<FlatList>` with `Card` components when similar titles exist.
- **Action in `mobile/src/screens/Search.js`:** Tapping a trending search item sets `text` and triggers search. Add type filter (`All` vs `Movies` vs `TV`).
- **Action:** Sync changes to root `src/` to preserve dual-structure parity.
- **Test:** Add tests in `mobile/test/client.test.js` for genre taxonomy and recommendation resolution.

### Step 4: Version Bump
- Update version in `package.json`, `server/package.json`, `mobile/package.json` to `"1.2.0"`.

### Step 5: Full Regression Run
- Run `npm test` across all workspaces. Must pass all tests with 0 failures.
