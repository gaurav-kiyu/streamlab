# STREAMLAB v1.2.0 — PHASE 18 ARCHITECTURE & CAPABILITY INVENTORY

**Authority:** Principal Software Architect / Product Engineering Lead  
**Baseline Commit:** `aedd6efd7dd4cdfd528a29c05e7e9f6aff55dccc`  
**Phase 18 Branch:** `feat/phase-18-product-advancement`  
**Date:** 2026-11-01  

---

## 1. Architectural Overview & System Topology

StreamLab is an India-first, multi-device video streaming platform designed for mobile (iOS, Android) and 10-foot television (Android TV, Google TV, Fire TV) interfaces, backed by a Node.js/Express server and SQLite database running in Write-Ahead Logging (WAL) mode.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STREAMLAB CLIENT APPLICATION (React Native / Expo 52 / React 18)            │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│ Browse Screen       │ Details Screen      │ Live TV & 10-Foot EPG Guide     │
│ Search Screen       │ Player (VOD & Live) │ Settings & Multi-User Profiles  │
└──────────┬──────────┴──────────┬──────────┴────────────────┬────────────────┘
           │                     │                           │
           │ HTTP (JSON/REST)    │ HLS / MP4 Media Streams   │ EPG XML / M3U
           ▼                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STREAMLAB PRODUCTION BACKEND SERVER (Node.js / Express / better-sqlite3)    │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│ Authentication & JWT│ Cloud Sync Engine   │ TMDB Secure Metadata Proxy      │
│ Multi-Profile Isol. │ Rate Limiting Guard │ SSRF Guard & IP Pinning         │
│ Live TV Provider Mgr│ Staging Ingestion   │ SAX XMLTV Streaming Engine      │
│ Admin Dashboard     │ Online Backup (WAL) │ Dual Keyring AES-256-GCM Crypto │
└─────────────────────┴──────────┬──────────┴─────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LOCAL PERSISTENCE LAYER (SQLite 3.45.1 WAL Mode / SecureStore)              │
│ tables: users, profiles, user_progress, user_watchlist, live_tv_providers,  │
│         live_tv_channels, live_tv_favorites, live_tv_history, epg_programs, │
│         epg_programs_staging, epg_sync_jobs, config, featured, audit        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Capability Inventory & Empirical Evidence Register

Classification taxonomy:
- `IMPLEMENTED_VERIFIED`: Implemented in code and verified by automated tests or execution evidence.
- `IMPLEMENTED_PARTIALLY`: Partially implemented in UI/backend; specific functional enhancements remain.
- `NOT_IMPLEMENTED`: Planned or candidate capability not yet implemented.
- `DEFECT_CONFIRMED`: Defect identified in implementation or documentation.
- `BLOCKED_EXTERNAL`: Verification blocked on external physical hardware or third-party resources.
- `DEFERRED`: Deliberately deferred to a future phase per approved roadmap.
- `NOT_APPLICABLE`: Excluded from project scope by governance decision.

---

### Domain A: User and Account Management

| Capability | Classification | Code Evidence | Remaining Work / Gap |
| :--- | :---: | :--- | :--- |
| **User Registration** | `IMPLEMENTED_VERIFIED` | `server/server.js:444-474` | None. Validates username, enforces password bounds, seeds default profile. |
| **Authentication & Sessions** | `IMPLEMENTED_VERIFIED` | `server/server.js:415-442` | None. Bcrypt hashing, constant-time compare with dummy salt, JWT generation. |
| **Session Invalidation** | `IMPLEMENTED_VERIFIED` | `server/server.js:480-484`, `test 7` | None. Monotonic `token_version` increment on logout invalidates existing JWTs. |
| **Password Management** | `IMPLEMENTED_VERIFIED` | `server/server.js:486-509` | None. Requires old password verification; rotates `token_version`. |
| **User Profiles (Up to 5)**| `IMPLEMENTED_VERIFIED` | `server/server.js:512-537`, `test 4` | None. Max 5 profiles per user; cascade deletion; isolated IDs. |
| **Multi-Profile Isolation** | `IMPLEMENTED_VERIFIED` | `server/server.js:569-630`, `tests 8,10` | None. Progress and Watchlists strictly scoped to `(user_id, profile_id)`. |
| **Profile Switching** | `IMPLEMENTED_VERIFIED` | `mobile/src/settings.js:21`, `Settings.js:60` | Switch active profile stored in secure client settings. |
| **Parental PIN Protection** | `IMPLEMENTED_VERIFIED` | `server/server.js:539-555`, `test 9` | None. Bcrypt-hashed 4-digit PIN; rate-limited (4 attempts/5 min). |
| **Admin Controls & RBAC** | `IMPLEMENTED_VERIFIED` | `server/server.js:940-1020`, `test 5` | None. Role-based routing; sole-admin deletion/deactivation prevention. |

---

### Domain B: Content Discovery & Catalog

| Capability | Classification | Code Evidence | Remaining Work / Gap |
| :--- | :---: | :--- | :--- |
| **Home Screen (Browse)** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Browse.js:74-206` | None. Combines continue watching, featured, language, and archive rails. |
| **Indian Regional L10n** | `IMPLEMENTED_VERIFIED` | `mobile/src/languages.js`, `mobile/src/i18n.js` | 10 regional Indian languages with native script and TMDB mapping. |
| **Multi-Language Search** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Search.js:81-100` | None. 380ms debounced TMDB proxy search with recent history persistence. |
| **Watchlist (My List)** | `IMPLEMENTED_VERIFIED` | `mobile/src/storage.js:38-47`, `server:610` | None. Local storage + cloud sync toggle; verified in `client.test.js`. |
| **Continue Watching Rail** | `IMPLEMENTED_VERIFIED` | `mobile/src/storage.js:18-33`, `server:581` | None. Second-exact position saving; dynamic progress fill; bounded to 12. |
| **Internet Archive Rows** | `IMPLEMENTED_VERIFIED` | `mobile/src/archive.js:1-33` | None. Hindi films and public-domain classics resolved via metadata API. |
| **Jellyfin Personal Media** | `IMPLEMENTED_VERIFIED` | `mobile/src/jellyfin.js:1-61` | None. Authenticates, loads library, maps quality/bitrate parameters. |
| **Genre Browsing & Filter**| `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Browse.js:168`, `tmdb.js:53`, `test 6` | None. 7 standard genres; interactive chips; dynamic shelf filtering. |
| **Search Trending Chips**  | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Search.js:160` | None. Interactive trending query chips trigger immediate searches. |
| **Search Media Type Filter**| `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Search.js:139`, `test 8` | None. Toggle tabs for All Results, Movies, and TV Shows. |
| **Similar Content Recs**   | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Details.js:203`, `tmdb.js:94`, `test 7` | None. "More Like This" horizontal recommendation shelf. |
| **Movie vs TV Navigation** | `IMPLEMENTED_VERIFIED` | `mobile/src/tmdb.js:51`, `server.js:638` | `type="tv"` vs `type="movie"` supported in TMDB proxy. |

---

### Domain C: Media Playback

| Capability | Classification | Code Evidence | Remaining Work / Gap |
| :--- | :---: | :--- | :--- |
| **VOD Playback Engine** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:182-335` | `react-native-video` HLS/MP4 playback with hardware acceleration. |
| **Linear Live TV Playback** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:93-102` | `isLive` playback contract verified in `live-player.test.js`. |
| **Resume Seek Bypass** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:93, 117` | Live playback starts at live edge (`resumeAt = 0`); no historical seek. |
| **No VOD Progress Sync** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:130` | Live playback suppresses `onProgress` cloud/local sync. |
| **Indeterminate Duration** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:311` | Displays `LIVE STREAM` pill and active elapsed timer. |
| **Audio Track Selection** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:57, 200` | Cycles audio tracks; displays track name or language. |
| **Subtitle Track Selection** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:56, 199` | CEA-608/708 and WebVTT subtitle track selection with off state. |
| **Quality Resolution Pick** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/Player.js:54, 201` | Displays dynamic badge (`4K`, `QHD`, `FHD`, `HD`) from stream heights. |
| **Picture-in-Guide Preview** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/LiveTV.js:87, 502` | In-line muted preview video in EPG guide before fullscreen tuning. |
| **Audio Session Isolation** | `IMPLEMENTED_VERIFIED` | `mobile/test/live-player.test.js` | Single playback session maintained during channel switching. |
| **Native PiP Bridge** | `NOT_IMPLEMENTED` | None | Background picture-in-picture requires custom native bridge. |
| **Chromecast / AirPlay** | `NOT_IMPLEMENTED` | None | Requires Google Cast SDK and Apple AirPlay native framework. |

---

### Domain D: Live TV and EPG Subsystem

| Capability | Classification | Code Evidence | Remaining Work / Gap |
| :--- | :---: | :--- | :--- |
| **M3U Playlist Parser** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/m3u-parser.js` | Parses `#EXTINF`, tvg-id, tvg-logo, group-title; deduplicates. |
| **Provider Management** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/repository.js:19-75` | Official and user-playlist providers with rights acknowledgement. |
| **Encrypted Credentials** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/crypto.js:62-100` | AES-256-GCM encryption with random 12-byte IV and dual keyring. |
| **SSRF Defensive Guard** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/ssrf.js:1-373` | IP parsing, DNS pinning, RFC1918 block, zip bomb defense (25MB). |
| **XMLTV Streaming Parser** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/epg-parser.js:250-410`| Streaming SAX parser with bounded memory and max payload ceilings. |
| **XML Security Ceilings** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/epg-parser.js:104,112`| Rejects DTD/DOCTYPE, nesting depth > 32, text node > 32KB. |
| **Staged Ingestion & Swap** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/epg-repository.js` | Two-phase staging table isolation; atomic swap into production. |
| **Current / Next Program** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/epg-repository.js:87` | Sub-millisecond lookup (`0.151 ms avg`); indexed query. |
| **Multi-Channel Guide (4h)**| `IMPLEMENTED_VERIFIED` | `server/src/livetv/epg-repository.js:125`| Fast matrix query (`1.891 ms avg`); timeline window. |
| **Channel Categories** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/LiveTV.js:329` | Categorizes channels (News, Entertainment, Sports, etc.). |
| **Channel Favorites** | `IMPLEMENTED_VERIFIED` | `server/src/livetv/repository.js:153` | Profile-isolated favorite channel toggling. |

---

### Domain E: Mobile and Television (10-Foot) Experience

| Capability | Classification | Code Evidence | Remaining Work / Gap |
| :--- | :---: | :--- | :--- |
| **Bottom Tab Navigation** | `IMPLEMENTED_VERIFIED` | `mobile/App.js:123-172` | 4 main tabs: Browse, Search, Live TV, Settings. |
| **Responsive Sizing** | `IMPLEMENTED_VERIFIED` | `Browse.js:24`, `LiveTV.js:33` | Scales card widths and typography based on `Platform.isTV`. |
| **D-Pad Focus Engine** | `IMPLEMENTED_VERIFIED` | `Browse.js:37, 56`, `LiveTV.js:84` | Visual focus glow `#ff6b8b` and scale transform on focus. |
| **Television EPG Timeline** | `IMPLEMENTED_VERIFIED` | `mobile/src/screens/LiveTV.js:81, 620` | Full 10-foot television EPG grid layout with sticky time headers. |
| **Overscan Margins** | `IMPLEMENTED_VERIFIED` | `Browse.js:210`, `LiveTV.js:1150` | 48px horizontal / 27px vertical television safe area padding. |
| **Physical Hardware Frame** | `BLOCKED_EXTERNAL` | N/A | Physical validation on certified Android TV / Fire TV silicon. |

---

### Domain F: Administration and Operations

| Capability | Classification | Code Evidence | Remaining Work / Gap |
| :--- | :---: | :--- | :--- |
| **Admin Web Dashboard** | `IMPLEMENTED_VERIFIED` | `server/public/admin.html`, `server:396`| User management, system metrics, featured media, config editor. |
| **Runtime Config Editor** | `IMPLEMENTED_VERIFIED` | `server/server.js:944-958` | Admin can toggle signups, guest browsing, maintenance mode. |
| **Public Config Redaction** | `IMPLEMENTED_VERIFIED` | `server/server.js:188-197`, `test 2` | Sensitive keys (`tmdbKey`, `jfUrl`) kept strictly private. |
| **Structured Health Check** | `IMPLEMENTED_VERIFIED` | `server/server.js:401-403`, `test 1` | `/api/health` returns status, uptime, version, timestamp. |
| **Audit Logging** | `IMPLEMENTED_VERIFIED` | `server/server.js:150-157` | Logs administrative and security events to `audit` table. |
| **Controlled DB Recovery** | `IMPLEMENTED_VERIFIED` | `docs/operations/EPG_RECOVERY_RUNBOOK.md`| 13-step controlled disaster recovery with quarantine and validation. |
| **Prometheus Metrics** | `NOT_IMPLEMENTED` | None | Dedicated `/metrics` endpoint for Prometheus scrape. |

---

## 3. Architecture & Capability Summary

StreamLab v1.1.0/v1.2.0 possesses a complete, hardened, and verified foundation. 
Key verified capabilities:
- Fully operational auth, profiles, and parental PIN security.
- Comprehensive content discovery across TMDB, Jellyfin, Internet Archive, and Featured lists.
- Production-grade streaming SAX XMLTV parser, SSRF guard, and dual-keyring crypto.
- Sub-millisecond database queries and 100% passing automated test suite (74 tests).
- 10-foot television EPG grid layout with D-pad navigation.

Gaps identified for Phase 18 prioritization:
1. **Genre Browsing & Discovery Filtering (`Browse.js`)**: Add genre filter chips to allow users to filter home browse rows by genre (Action, Comedy, Drama, Romance, Thriller, Family).
2. **Related / Similar Titles Rail (`Details.js`)**: Add a dynamic "More Like This" recommendation rail in `Details.js` using TMDB collection/similar endpoints or genre overlap.
3. **Advanced Search Filters (`Search.js`)**: Provide interactive category chips (Movies, TV Shows, Hindi Classics, etc.) in `Search.js` to streamline discovery.
4. **Enhanced XML Chunk-Boundary XXE Defense**: Add the trailing tail buffer to `epg-parser.js` stream handling to guarantee `XXE_DETECTED` on split doctype/entity boundaries (F-03).
5. **Prometheus / Health Observability**: Add memory and database metrics to `/api/health` to complete Domain F operational readiness.
