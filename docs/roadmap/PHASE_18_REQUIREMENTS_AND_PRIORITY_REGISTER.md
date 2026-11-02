# STREAMLAB v1.2.0 — PHASE 18 REQUIREMENTS & PRIORITY REGISTER

**Authority:** Principal Software Architect / Product Engineering Lead / Application Security Lead  
**Baseline Commit:** `aedd6efd7dd4cdfd528a29c05e7e9f6aff55dccc`  
**Phase 18 Branch:** `feat/phase-18-product-advancement`  
**Target Milestone:** StreamLab v1.2.0  
**Date:** 2026-11-01  

---

## 1. Prioritization Framework

Requirements are prioritized according to standard engineering governance:
- **`P0`**: Critical security, data integrity, or core system stability requirement.
- **`P1`**: Core product capability directly addressing essential user discovery and playback.
- **`P2`**: Usability, operational observability, or performance enhancement.
- **`P3`**: Optional enhancement or forward-looking architectural preparation.

---

## 2. Phase 18 Prioritized Requirements Register

| ID | Requirement | Current State | Priority | Dependencies | Acceptance Criteria | Supporting Evidence |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- |
| **REQ-18-01** | **Chunk-Boundary XXE Defense-in-Depth** | `IMPLEMENTED_PARTIALLY` | **P0** | `server/src/livetv/epg-parser.js` | Parser must track a trailing 16-byte tail buffer across stream chunks to catch `<!DOCTYPE` and `<!ENTITY` split across packet boundaries with `XXE_DETECTED`. | F-03 reconciliation; XMLTV security standard. |
| **REQ-18-02** | **Genre Discovery Browsing & Filter Chips** | `IMPLEMENTED_PARTIALLY` | **P1** | `mobile/src/screens/Browse.js`, `mobile/src/tmdb.js` | Browse screen provides interactive genre filter chips (All, Action, Comedy, Drama, Romance, Thriller, Family); selection dynamically filters displayed shelves. | `STREAMLAB_PRODUCT_ROADMAP.md` Domain 1. |
| **REQ-18-03** | **Similar Content & Recommendations Shelf** | `IMPLEMENTED_PARTIALLY` | **P1** | `mobile/src/screens/Details.js`, `mobile/src/tmdb.js` | Details screen displays a horizontal "More Like This" / similar titles shelf; tapping a card navigates to the selected movie details. | `STREAMLAB_PRODUCT_ROADMAP.md` Domain 1. |
| **REQ-18-04** | **Interactive Search Trending Chips & Type Filter** | `IMPLEMENTED_PARTIALLY` | **P2** | `mobile/src/screens/Search.js` | Trending chips in Search are interactive (tap to search); supports filtering between Movies and TV shows. | `STREAMLAB_PRODUCT_ROADMAP.md` Domain 1. |
| **REQ-18-05** | **Expanded System Health & Diagnostics API** | `IMPLEMENTED_PARTIALLY` | **P2** | `server/server.js:401` | `/api/health` returns memory RSS/heap, database table counts, and provider summary while preserving zero secret leakage. | `STREAMLAB_PRODUCT_ROADMAP.md` Domain 5. |
| **REQ-18-06** | **Monorepo Version Alignment (v1.2.0)** | `IMPLEMENTED_PARTIALLY` | **P2** | Root, server, and mobile `package.json` | Version bumped from `0.2.0` to `1.2.0` consistently across all workspaces. | Phase 18 governance mandate. |
| **REQ-18-07** | **Expanded Test Suite (78+ Tests)** | `IMPLEMENTED_VERIFIED` | **P0** | `server/test`, `mobile/test` | New tests verifying chunk-boundary XXE, genre filtering, recommendations, and health diagnostics; 100% pass rate. | Monorepo test governance. |

---

## 3. Detailed Work Item Specifications

### REQ-18-01: Chunk-Boundary XXE Defense-in-Depth
- **User Problem:** Attackers might attempt to evade pre-tokenization regex inspection by splitting XML entity tokens (e.g. `<!DOC` and `TYPE`) across streaming chunks.
- **Security Invariant:** SAX parser state machine already catches this via `ondoctype`, but pre-screen regex must also inspect boundary-straddling text as defense-in-depth.
- **Acceptance Criteria:** A unit test in `epg-streaming.test.js` feeding a split token `["<tv><!DOC", "TYPE tv [<!ENTITY x 'y'>]></tv>"]` cleanly throws `XXE_DETECTED`.

### REQ-18-02: Genre Discovery Browsing & Filter Chips
- **User Problem:** Users browsing content on mobile or TV want to narrow down films by mood/genre without typing in search.
- **Acceptance Criteria:** `Browse.js` renders a horizontal genre selection row with D-pad focusability (`Platform.isTV`). Selecting a genre filters the displayed shelves to match that category.

### REQ-18-03: Similar Content & Recommendations Shelf
- **User Problem:** After viewing a movie's details, users want relevant recommendations to continue their viewing session.
- **Acceptance Criteria:** `Details.js` loads and displays a "More Like This" horizontal card carousel with posters, titles, and ratings; selecting an item opens its details.

### REQ-18-04: Interactive Search Trending Chips & Type Filter
- **User Problem:** Trending search tags were static and could not be clicked to initiate searches.
- **Acceptance Criteria:** Tapping any trending search pill populates the search query and immediately fetches results.

### REQ-18-05: Expanded System Health & Diagnostics API
- **User Problem:** Monitoring tools (e.g. Uptime Kuma, Prometheus) need insight into memory pressure and database size to detect leaks before an outage.
- **Acceptance Criteria:** `/api/health` returns `memory` (`rss`, `heapUsed`, `heapTotal` in MB) and `database` statistics.
