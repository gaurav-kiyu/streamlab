# StreamLab v1.2.0

**India-First Multi-OTT Content Discovery & Streaming Platform**

StreamLab is a production-grade, multi-platform media application built with Expo (React Native), Node.js, and AndroidX Media3 ExoPlayer. It features an India-first entertainment discovery engine across 11 regional languages, unified multi-OTT availability tracking with direct app handoff, personal Jellyfin library streaming, and authorized public-domain media playback.

---

## 🌟 Key Product Capabilities

### 1. India-First Entertainment Architecture
* **Immediate Cultural Landing:** The Browse surface immediately communicates *"Indian Entertainment — All Your Languages, All Your Platforms"* on first launch.
* **11 Regional Content Languages:** Dedicated content discovery for Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Malayalam (`ml`), Kannada (`kn`), Bengali (`bn`), Marathi (`mr`), Punjabi (`pa`), Gujarati (`gu`), Assamese (`as`), and Odia (`or`), plus unified All India (`all`).
* **9 Curated Home Shelves:** Trending in India, Hindi Blockbusters, South Indian Cinema, Regional Indian Cinema, OTT Highlights, Free Indian Content, Indian Family & Kids, Classics & Documentaries, and Live Television.
* **Strict Language Property Separation:** Rigorously distinguishes original production language from verified dubbed audio tracks and subtitles (`Audio language information unavailable` displayed when dubbing metadata is unverified).

### 2. Multi-OTT Platform Discovery & Handoff
* **14 Indian Streaming Providers:** Integrated availability tracking for JioHotstar, Amazon Prime Video, Netflix, SonyLIV, ZEE5, Sun NXT, aha, Hoichoi, ETV Win, Amazon MX Player, ManoramaMAX, Chaupal, Planet Marathi, and Prasar Bharati WAVES.
* **Monetization Filtering:** Filter titles by Free, Free with Ads, Subscription, and Rent/Buy.
* **Secure Universal App Handoff:** One-tap launching of native streaming applications or verified web destinations via allowlisted schemes (`validateExternalUrl`).
* **Ethical Compliance:** Zero DRM circumvention; operates as a legal discovery and handoff guide.

### 3. Media Player & Streaming Pipeline
* **Native Video Engine:** `react-native-video` backed by AndroidX Media3 ExoPlayer.
* **Dedicated Navigation Controls:** Persistent tap interception with explicit fast seek buttons (`-20s`, `-10s`, `+10s`, `+20s`), boundary clamping, and live stream seek immunity.
* **Multi-Format Playback:** Progressive MP4 and adaptive HLS streaming with audio and subtitle selectors.
* **Continue Watching:** Synchronized playback progress with auto-resume across sessions.
* **Offline Storage:** Download manager for personal media and public-domain archive titles.

### 4. High-Security Backend Proxy
* **Allowlisted TMDB Proxy:** 8 explicit typed server endpoints protecting API credentials.
* **Invariant Defense:** Numeric TMDB ID validation (`/^\d+$/`), query parameter allowlisting, and SSRF prevention.
* **Performance:** Bounded in-memory LRU cache (500 entries, 15-minute TTL) with 6-second wall-clock timeout protection.

---

## 🚀 Quick Start

### Prerequisites
* Node.js 18+ (tested on Node.js 24)
* Android SDK / ADB (for physical device and TV deployment)

### 1. Backend Server Setup
```bash
cd server
npm install
npm test
npm start
```
*Server boots on `http://127.0.0.1:3000` with SQLite WAL mode.*

### 2. Mobile App Setup
```bash
cd mobile
npm install
npm test
npm start
```

---

## 🧪 Automated Test Suite (100% Pass)

StreamLab maintains a comprehensive automated unit and integration test suite:

```text
==================================================
STREAMLAB TEST SUITE CONSOLIDATED RESULTS
==================================================
Server Security, EPG, LiveTV & TMDB:  70 / 70 PASSED
Mobile UX, Player, Discovery & Langs:  29 / 29 PASSED
--------------------------------------------------
Total Passing Automated Tests:         99 / 99 PASSED (100%)
==================================================
```

Run test suites:
```bash
# Server test suite
npm run server:test

# Mobile test suite
npm run mobile:test
```

---

## 📜 Attribution & Legal Compliance

* **TMDB Notice:** This product uses the TMDB API but is not endorsed or certified by TMDB.
* **JustWatch Notice:** Streaming availability data powered by JustWatch.
* **Content Classification:** Strict separation between Category 1 (Direct Play for owned/licensed media), Category 2 (External OTT Handoff), and Category 3 (Verified Free Public Domain).

---
*StreamLab is engineered for high-performance mobile and TV entertainment discovery.*
