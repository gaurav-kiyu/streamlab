# STREAMLAB v1.2.0 — PHASE 22.3
# CONTENT RIGHTS & INTEGRATION MATRIX

**Authority:** Principal Software Architect / Application Security Lead / DevSecOps Lead  
**Date:** November 2, 2026  
**Status:** COMPLETE & ENFORCED  
**Application:** StreamLab v1.2.0 (`com.streamlab.app`)  

---

## 1. THE THREE-TIER CONTENT RIGHTS ARCHITECTURE

To ensure total legal compliance and prevent copyright infringement, StreamLab categorizes all discoverable media into three mutually exclusive operational tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CONTENT CLASSIFICATION MODEL                      │
├───────────────────┬───────────────────────────────┬────────────────────┤
│ Category          │ Media Nature                  │ Permitted Action   │
├───────────────────┼───────────────────────────────┼────────────────────┤
│ 1. Direct Play    │ User-Owned / Self-Hosted      │ Native ExoPlayer   │
│ 2. OTT Handoff    │ Commercial Paid / SVOD / TVOD │ Official App/Link  │
│ 3. Verified Free  │ Public Domain / Broadcaster   │ ExoPlayer / Link   │
└───────────────────┴───────────────────────────────┴────────────────────┘
```

---

## 2. DETAILED CATEGORY PROFILES

### Category 1 — Directly Playable (Self-Hosted & Authorized)
* **Scope:**
  - User-owned Jellyfin servers (`jfUrl` / `jfToken`).
  - Self-hosted personal HLS libraries.
  - Authorized testing streams with permissive licenses.
* **StreamLab Action:**
  - Native playback within `react-native-video` (ExoPlayer on Android).
  - Audio and subtitle track selection.
  - Resume state tracking in local SQLite / cloud sync.
  - Offline download if authorized by user server configuration.
* **Action Button in UI:** `▶  Play Now (Authorized Source)`.

### Category 2 — External OTT Handoff (Commercial Subscription & Paywalled)
* **Scope:**
  - Content hosted on commercial OTTs (JioHotstar, Amazon Prime Video, Netflix, SonyLIV, ZEE5, Sun NXT, aha, Hoichoi, etc.).
  - Encrypted using Widevine L1, PlayReady, or FairPlay DRM.
* **StreamLab Action:**
  - Metadata discovery (posters, synopsis, cast, ratings via TMDB / JustWatch).
  - Display available platforms and access models (Subscription, Free with Ads, Rent).
  - Handoff directly to the official provider app or website via validated deep links (`Linking.openURL`).
  - **NEVER** scrape stream URLs or attempt DRM decryption.
* **Action Button in UI:** `Watch on [Provider Name] ↗`.

### Category 3 — Official Free Content (Public Domain & Broadcaster)
* **Scope:**
  - Internet Archive verified public-domain Indian classic cinema (e.g., pre-1955 films, Raja Harishchandra, Alam Ara documentation, historical archives).
  - Authorized open educational or cultural broadcasts (e.g., Creative Commons licensed).
* **StreamLab Action:**
  - Direct progressive MP4 or HLS playback if permitted by terms of service.
  - Clear labeling as "Public Domain · Internet Archive" or "Official Free Content".
  - Offline download enabled only where open license permits.
* **Action Button in UI:** `▶  Watch Free Classic`.

---

## 3. RIGHTS METADATA RETENTION SCHEMA

For every playable stream integrated into StreamLab, the application requires and maintains the following metadata structure:

| Metadata Field | Description | Example (Jellyfin) | Example (Internet Archive) |
| :--- | :--- | :--- | :--- |
| **`rights_holder`** | Verified legal entity or owner | User (Personal Media) | Public Domain / Original Producer |
| **`license_type`** | Permitted use framework | Self-Hosted / Private Use | Public Domain / CC-BY-NC |
| **`territory`** | Geographically permitted zones | Private Network | Worldwide |
| **`permitted_playback`**| Authorized playback mechanism | Native HLS Transcode | Native Progressive MP4 |
| **`download_allowed`**| Authorization for local storage| Configurable by admin | Yes (Public Domain) |
| **`revalidation_date`**| Mandatory rights expiry check | Periodic server check | Permanent Public Domain |
| **`attribution_req`** | Required on-screen notice | None | Internet Archive Attribution |

---

## 4. STRICT NON-CIRCUMVENTION AUDIT

StreamLab strictly adheres to the following digital ethics rules:
1. **Zero DRM Bypass:** The application contains zero code designed to bypass, decrypt, extract keys from, or emulate Widevine Modular, PlayReady, or FairPlay DRM.
2. **Zero Unauthorized Proxying:** Commercial OTT video fragments are never proxied through the StreamLab server.
3. **Deep Link Sanctity:** External provider links must be validated against allowlisted HTTPS protocols and registered application schemes (`validateExternalUrl`). Disallowed protocols (`javascript:`, `data:`, `file:`) are blocked immediately to prevent SSRF and injection attacks.
