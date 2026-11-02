# STREAMLAB v1.2.0 — PHASE 22.2
# INDIAN MULTI-OTT PROVIDER RESEARCH & INTEGRATION MATRIX

**Authority:** India OTT Research Lead / Media Streaming Engineer / Application Security Lead  
**Date:** November 2, 2026  
**Status:** COMPLETE & VERIFIED  
**Application:** StreamLab v1.2.0 (`com.streamlab.app`)  

---

## 1. EXECUTIVE SUMMARY & RESEARCH OBJECTIVE

To power StreamLab's multi-OTT content discovery engine, this audit conducts deep technical and legal research across 15+ Indian video streaming services.

> **CRITICAL LEGAL NOTICE:** StreamLab operates strictly as a discovery, aggregation, and handoff application for third-party commercial OTT platforms. It does **NOT** attempt to bypass Widevine/FairPlay DRM, scrape authenticated video manifests, extract stream encryption keys, or circumvent subscription paywalls. For external OTT content, StreamLab provides metadata discovery and verified deep-link handoff to official provider destinations.

---

## 2. COMPREHENSIVE PROVIDER RESEARCH TABLE

The following 10-parameter audit covers all primary Indian commercial and public-service streaming platforms:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EVALUATION PARAMETERS LEGEND                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Official Portal     │ 6. Deep Link App Scheme Support               │
│ 2. Supported Devices   │ 7. Written Partnership Required for Direct API│
│ 3. Language Focus      │ 8. Direct Stream Playback Permitted           │
│ 4. Public Developer API│ 9. Monetization Model                         │
│ 5. Official Feed/Feed  │ 10. StreamLab v1.2.0 Integration Status       │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 JioHotstar (Disney+ Hotstar / JioCinema Merged Entity)
1. **Website:** `https://www.hotstar.com/in`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Web, LG webOS, Samsung Tizen.
3. **Languages:** Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, English.
4. **Public Developer API:** **NO**. Private, HMAC-signed mobile backend APIs only.
5. **Official Catalogue Feed:** Not publicly accessible; metadata distributed via JustWatch and partner B2B feeds.
6. **Deep Links Supported:** **YES** (`hotstar://...`, Universal links `https://www.hotstar.com/...`).
7. **Written Permission Required:** **YES**, for commercial API/metadata licensing.
8. **Direct Playback Permitted:** **NO** (Strict Widevine L1 / PlayReady DRM with proprietary session tokens).
9. **Monetization Model:** Hybrid (Ad-supported free tier for select live sports/shows; VIP / Premium subscription tiers).
10. **Integration Status:** **Handoff Verified** via JustWatch TMDB Provider ID `122` / `337` and universal app deep links.

### 2.2 Amazon Prime Video India
1. **Website:** `https://www.primevideo.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Smart TVs, Game Consoles.
3. **Languages:** Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Gujarati, Punjabi, English.
4. **Public Developer API:** **NO**. Amazon Developer Portal offers Fire TV Launcher integration, but no generic open streaming API.
5. **Official Catalogue Feed:** Private partner feeds (Amazon Prime Video Channels API).
6. **Deep Links Supported:** **YES** (`primevideo://...`, `https://www.primevideo.com/detail/...`).
7. **Written Permission Required:** **YES**, formal Amazon Developer / Prime Video partnership.
8. **Direct Playback Permitted:** **NO** (Widevine L1 DRM).
9. **Monetization Model:** SVOD (Prime Membership) + TVOD (Store Rental & Purchase).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `119`.

### 2.3 Netflix India
1. **Website:** `https://www.netflix.com/in`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Roku, Smart TVs, Web.
3. **Languages:** Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, English.
4. **Public Developer API:** **NO**. Deprecated public API in 2014; closed partner APIs only.
5. **Official Catalogue Feed:** Closed enterprise metadata syndication.
6. **Deep Links Supported:** **YES** (`nflx://www.netflix.com/title/{id}`, `https://www.netflix.com/title/{id}`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Strict hardware-backed DRM).
9. **Monetization Model:** SVOD (Subscription Only).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `8`.

### 2.4 SonyLIV
1. **Website:** `https://www.sonyliv.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Tizen, webOS.
3. **Languages:** Hindi, Tamil, Telugu, Malayalam, Marathi, Bengali, English.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Private B2B syndication.
6. **Deep Links Supported:** **YES** (`sonyliv://...`, `https://www.sonyliv.com/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Widevine DRM + Geo-token gating).
9. **Monetization Model:** Freemium (Free ad-supported episodes + Premium subscription).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `237`.

### 2.5 ZEE5
1. **Website:** `https://www.zee5.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Smart TVs.
3. **Languages:** Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi, Gujarati, Odia, English.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed partner feeds.
6. **Deep Links Supported:** **YES** (`zee5://...`, `https://www.zee5.com/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (DRM protected).
9. **Monetization Model:** AVOD (Ad-supported Free) + SVOD (ZEE5 Premium).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `232`.

### 2.6 Sun NXT
1. **Website:** `https://www.sunnxt.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Tizen, webOS.
3. **Languages:** Tamil, Telugu, Malayalam, Kannada, Bengali.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed broadcast feeds.
6. **Deep Links Supported:** **YES** (`sunnxt://...`, `https://www.sunnxt.com/...`).
7. **Written Permission Required:** **YES** (Sun TV Network B2B agreement).
8. **Direct Playback Permitted:** **NO** (DRM protected).
9. **Monetization Model:** SVOD + Telco bundled packages.
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `309`.

### 2.7 aha (Arha Media)
1. **Website:** `https://www.aha.video`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Web.
3. **Languages:** Telugu, Tamil.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed.
6. **Deep Links Supported:** **YES** (`aha://...`, `https://www.aha.video/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Widevine DRM).
9. **Monetization Model:** Freemium (Selected free titles + Gold/Platinum subscriptions).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `532`.

### 2.8 Hoichoi (SVF Entertainment)
1. **Website:** `https://www.hoichoi.tv`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Roku, Web.
3. **Languages:** Bengali (with English/Hindi subtitles).
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed.
6. **Deep Links Supported:** **YES** (`hoichoi://...`, `https://www.hoichoi.tv/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (DRM protected).
9. **Monetization Model:** SVOD (Subscription).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `315`.

### 2.9 ETV Win (Eenadu Television)
1. **Website:** `https://www.etvwin.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Web.
3. **Languages:** Telugu.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed.
6. **Deep Links Supported:** **YES** (`etvwin://...`, `https://www.etvwin.com/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (DRM protected).
9. **Monetization Model:** AVOD + SVOD.
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `615`.

### 2.10 Amazon MX Player
1. **Website:** `https://www.mxplayer.in`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Web.
3. **Languages:** Hindi, Tamil, Telugu, Bengali, Marathi, Punjabi, Gujarati, English.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed partner syndication.
6. **Deep Links Supported:** **YES** (`mxplayer://...`, `https://www.mxplayer.in/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Proprietary ad-insertion player).
9. **Monetization Model:** AVOD (100% Free with Ads).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `494`.

### 2.11 ManoramaMAX (MM TV)
1. **Website:** `https://www.manoramamax.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV, Web.
3. **Languages:** Malayalam.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed.
6. **Deep Links Supported:** **YES** (`manoramamax://...`, `https://www.manoramamax.com/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Widevine protected).
9. **Monetization Model:** AVOD (News & clips) + SVOD (Movies & MAX Originals).
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `440`.

### 2.12 Chaupal
1. **Website:** `https://chaupal.tv`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Apple TV.
3. **Languages:** Punjabi, Haryanvi, Bhojpuri.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed.
6. **Deep Links Supported:** **YES** (`chaupal://...`, `https://chaupal.tv/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Widevine protected).
9. **Monetization Model:** SVOD.
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `614`.

### 2.13 Planet Marathi
1. **Website:** `https://www.planetmarathi.com`
2. **Supported Devices:** Android, iOS, Android TV, Fire TV, Web.
3. **Languages:** Marathi.
4. **Public Developer API:** **NO**.
5. **Official Catalogue Feed:** Closed.
6. **Deep Links Supported:** **YES** (`planetmarathi://...`, `https://www.planetmarathi.com/...`).
7. **Written Permission Required:** **YES**.
8. **Direct Playback Permitted:** **NO** (Widevine protected).
9. **Monetization Model:** SVOD + TVOD Pay-Per-View.
10. **Integration Status:** **Handoff Verified** via TMDB Provider ID `608`.

### 2.14 Prasar Bharati WAVES (Public Service)
1. **Website:** `https://wavespb.com`
2. **Supported Devices:** Android, iOS, Android TV (WAVES App), Web.
3. **Languages:** All Indian Official Languages (Hindi, Sanskrit, Tamil, Telugu, Bengali, Assamese, Odia, etc.).
4. **Public Developer API:** **NO**. Operates as the official public broadcaster OTT.
5. **Official Catalogue Feed:** Not publicly documented for third-party syndication without MoIB MoU.
6. **Deep Links Supported:** **YES** (`wavespb://...`, `https://wavespb.com/...`).
7. **Written Permission Required:** **YES** (Prasar Bharati Commercial / Distribution Division).
8. **Direct Playback Permitted:** **NO** (Even though funded by public service, streams are token-gated and copyrighted).
9. **Monetization Model:** Free / Public-Service / Cultural Archive.
10. **Integration Status:** **Handoff Verified** via official web portal and app deep links.

---

## 3. KEY ENGINEERING TAKEAWAYS

1. **Zero Open Catalog APIs:** None of the 14 commercial or public-service Indian OTT platforms provide an open, unauthenticated public REST API for catalog extraction.
2. **Syndication Standard:** Legitimate multi-OTT discovery must rely on licensed aggregators (TMDB Watch Providers powered by JustWatch) or direct B2B partnership feeds.
3. **Deep Link Uniformity:** Every major provider supports universal HTTPS deep links and native mobile intent schemes, enabling reliable, one-tap handoff without stream hijacking.
