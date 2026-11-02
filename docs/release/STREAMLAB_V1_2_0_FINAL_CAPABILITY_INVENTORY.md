# STREAMLAB v1.2.0 — FINAL CAPABILITY INVENTORY

**Authority:** Principal Software Architect / Product Engineering Lead  
**Version:** StreamLab v1.2.0  
**Commit:** `d2c6882eee9a567d7d8d9a1ddab0c23c3d16c53f`  
**Date:** 2026-11-01  
**Governance Status:** `ENGINEERING_COMPLETE`  

---

## 1. SUBSYSTEM CAPABILITY MATRIX

| Subsystem | Feature / Capability | Implementation Status | Evidence / Verification Test |
| :--- | :--- | :--- | :--- |
| **Core Playback** | VOD Video Playback with Resume Points | `IMPLEMENTED_VERIFIED` | `mobile/test/client.test.js` (Test 4) |
| **Core Playback** | Live TV Mode (`isLive`) Contract | `IMPLEMENTED_VERIFIED` | `mobile/test/live-player.test.js` (Live Player 1) |
| **Core Playback** | Indeterminate Duration & Single Playback Session | `IMPLEMENTED_VERIFIED` | `mobile/test/live-player.test.js` (Live Player 4) |
| **Core Playback** | Picture-in-Guide Mini-Player Isolation | `IMPLEMENTED_VERIFIED` | `mobile/test/live-player.test.js` (Live Player 3) |
| **Discovery & Search** | Curated Genre Taxonomy & Filtering | `IMPLEMENTED_VERIFIED` | `mobile/test/client.test.js` (Test 6) |
| **Discovery & Search** | Recommendation & Similar Content Interface | `IMPLEMENTED_VERIFIED` | `mobile/test/client.test.js` (Test 7) |
| **Discovery & Search** | Search Media Type Filters (`all`, `movie`, `tv`, `live`) | `IMPLEMENTED_VERIFIED` | `mobile/test/client.test.js` (Test 8) |
| **Discovery & Search** | Trending Search Chips & Real-time Suggestions | `IMPLEMENTED_VERIFIED` | `src/components/SearchBar.js`, `mobile/src/components/SearchBar.js` |
| **Localization** | 10 Indian Languages with Normalized Codes & Bilingual UI | `IMPLEMENTED_VERIFIED` | `mobile/test/client.test.js` (Test 1) |
| **User & Profile** | Multi-Profile Isolation & Cross-Profile Boundary | `IMPLEMENTED_VERIFIED` | `server/test/server.test.js` (Tests 8, 10) |
| **User & Profile** | Parental PIN Enforcement with Brute-Force Rate Limiting | `IMPLEMENTED_VERIFIED` | `server/test/server.test.js` (Test 9) |
| **User & Profile** | Watchlist (My List) Toggle & Offline Persistence | `IMPLEMENTED_VERIFIED` | `mobile/test/client.test.js` (Test 5) |
| **Live TV / M3U** | M3U Parser (Attributes, Duplicates, Malformed) | `IMPLEMENTED_VERIFIED` | `server/test/livetv.test.js` (Live TV 2) |
| **Live TV / M3U** | Channel Repository & Profile Isolation | `IMPLEMENTED_VERIFIED` | `server/test/livetv.test.js` (Live TV 6) |
| **Live TV / M3U** | Import Job Lock Manager & Stale Lock Recovery | `IMPLEMENTED_VERIFIED` | `server/test/livetv.test.js` (Live TV 7) |
| **EPG / XMLTV** | SAX Streaming XMLTV Ingestion (Bounded Memory) | `IMPLEMENTED_VERIFIED` | `server/test/epg-streaming.test.js` (Tests 1-8) |
| **EPG / XMLTV** | Chunk-Boundary Split-Token XXE Detection | `IMPLEMENTED_VERIFIED` | `server/test/epg-streaming.test.js` (Test 9) |
| **EPG / XMLTV** | Staging Isolation, Transactional Swap & Discard | `IMPLEMENTED_VERIFIED` | `server/test/epg-atomic-recovery.test.js` (Tests 1, 3) |
| **EPG / XMLTV** | Multi-Channel Guide Matrix & High-Speed Current/Next | `IMPLEMENTED_VERIFIED` | `server/test/epg-atomic-recovery.test.js` (Test 4) |
| **EPG / Timeline** | EPG Timeline Progress Bar & Time-to-End Calculation | `IMPLEMENTED_VERIFIED` | `mobile/test/live-player.test.js` (Live Player 2) |
| **Security & Cryptography** | AES-256-GCM Credential Encryption & Dual Keyring | `IMPLEMENTED_VERIFIED` | `server/test/crypto-hardening.test.js` (Tests 1-4) |
| **Security & Network** | SSRF Defensive Guard & IP Pinning Contract | `IMPLEMENTED_VERIFIED` | `server/test/ssrf-integration.test.js` (Tests 1-16) |
| **Security & Network** | Decompression Bomb Protection (Gzip limit 50MB) | `IMPLEMENTED_VERIFIED` | `server/test/ssrf-integration.test.js` (Tests 14, 15) |
| **Telemetry & Observability**| System Health & Status Endpoint (`/api/health`) | `IMPLEMENTED_VERIFIED` | `server/test/server.test.js` (Test 1) |
| **Telemetry & Observability**| Prometheus Scrapable Metrics Endpoint (`/metrics`) | `NOT_IMPLEMENTED` | Explicit backlog; not confused with `/api/health` |
| **Device Hardware** | Android TV / Fire TV Physical D-pad Remote QA | `BLOCKED_EXTERNAL` | Documented in `PHASE_18_EXTERNAL_VALIDATION_REGISTER.md` |

---

## 2. SUBSYSTEM ARCHITECTURAL SPECIFICATIONS

### 2.1 Playback Engine Contract (`isLive`)
* When `isLive: true` is supplied to `StreamLabPlayer` or `LivePlayer`:
  - `startPositionMillis` is bypassed and forced to `0`.
  - Resume dialogs and position recovery logic are suppressed.
  - Video scrub bar is locked in live broadcast mode (no seek past current broadcast edge).
  - Background completion events (`/api/progress` mark completed) are disabled.
  - Duration is handled as indeterminate (`Infinity` or `0`).

### 2.2 EPG XMLTV Ingestion Pipeline
* Stream-based parsing via `sax` (strict mode):
  - Memory ceiling: batches of 500 records are written to staging tables to guarantee bounded RSS memory (<120MB heap) even on 100MB+ guide files.
  - Split-token XXE protection: a 64-byte rolling lookback buffer preserves tokens across chunk boundaries, preventing bypass via sliced `<!ENTITY` or `SYSTEM` declarations.
  - Atomic swap: ingestion writes into staging tables; on complete parse and validation, an atomic SQLite transaction updates production channel-programme mappings. On abort or error, staging tables are wiped.

### 2.3 Cryptographic Keyring & Entropy
* Primary key: `LIVETV_ENCRYPTION_KEY` validated for length $\ge 32$ characters.
* Key Derivation: Key is derived via `crypto.scryptSync(secret, "streamlab_livetv_salt_2026", 32)`.
* Dual Keyring: Supports seamless rotation via `LIVETV_ENCRYPTION_KEY_FALLBACKS` allowing instant re-encryption of stored credentials without service interruption.

### 2.4 Telemetry vs Monitoring Clarification
* StreamLab exposes `/api/health` which delivers JSON-formatted uptime, memory usage, database status, and active background sync job indicators.
* A Prometheus-compatible scrape endpoint (`/metrics`) exposing OpenMetrics format counters and histograms is **NOT IMPLEMENTED** in v1.2.0 and remains an explicitly deferred roadmap item for enterprise telemetry.
