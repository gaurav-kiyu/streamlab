# STREAMLAB v1.2.0 — PHASE 22.5
# MOBILE USER EXPERIENCE (UX) ARCHITECTURE & AUDIT REPORT

**Authority:** Product Engineering Lead / Android QA Lead / UI/UX Specialist  
**Date:** November 2, 2026  
**Status:** COMPLETE & VERIFIED  
**Application:** StreamLab v1.2.0 (`com.streamlab.app`)  

---

## 1. USER EXPERIENCE PHILOSOPHY & OBJECTIVES

The Phase 22 UX overhaul transforms StreamLab into an intuitive, high-velocity Indian entertainment discovery interface. The primary objective is to minimize friction: users should experience immediate cultural familiarity without navigating configuration submenus or foreign language defaults.

---

## 2. BROWSE SCREEN ENHANCEMENTS

### 2.1 Hero Announcement & Branding
* **Prominent Header:** Renders immediately at the top of the Browse tab:
  - Title: `Indian Entertainment`
  - Subtitle: `All Your Languages, All Your Platforms`
* **Zero Delay:** Loaded synchronously; establishes immediate identity before network shelves populate.

### 2.2 Regional Indian Language Selector Bar
* **Horizontal Scroll:** Positioned directly below the hero header.
* **12 Dedicated Chips:**
  - `All India` (`all` — **Default**)
  - `हिन्दी  Hindi` (`hi`)
  - `தமிழ்  Tamil` (`ta`)
  - `తెలుగు  Telugu` (`te`)
  - `മലയാളം  Malayalam` (`ml`)
  - `ಕನ್ನಡ  Kannada` (`kn`)
  - `বাংলা  Bengali` (`bn`)
  - `मराठी  Marathi` (`mr`)
  - `ਪੰਜਾਬੀ  Punjabi` (`pa`)
  - `ગુજરાતી  Gujarati` (`gu`)
  - `অসমীয়া  Assamese` (`as`)
  - `ଓଡ଼ିଆ  Odia` (`or`)
* **State Persistence:** User's selected dialect is remembered in local settings via `saveSettings({ lang: code })`.

### 2.3 Multi-OTT Provider Filter Pills
* **Dynamic Provider Bar:** Renders beneath the language bar, allowing instant filtering across major Indian streaming services:
  - `All Platforms`
  - `Free Legal Content`
  - `JioHotstar`
  - `Prime Video`
  - `Netflix`
  - `SonyLIV`
  - `ZEE5`
  - `Sun NXT`
  - `aha`
  - `Hoichoi`
  - `ETV Win`
  - `MX Player`
  - `ManoramaMAX`
  - `Chaupal`
  - `Planet Marathi`

### 2.4 Visual Content Badges
To provide immediate visual clarity on content type and legal status before tapping:
* **`FREE` Badge (Emerald Green `#2ed573`):** Displayed on public-domain archive titles and verified ad-supported free releases.
* **`SERIES` Badge (Dodger Blue `#1e90ff`):** Displayed on episodic web series and television shows.

---

## 3. DETAILS SCREEN & EXTERNAL OTT HANDOFF

### 3.1 Strict Playback vs Handoff Differentiation
The Details screen eliminates all user confusion regarding what StreamLab can play directly versus what requires external provider access:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DETAILS ACTION BUTTON LOGIC                     │
├──────────────────────────┬─────────────────────────────┬───────────────┤
│ Media Classification     │ Rendered Primary Action     │ Action Trigger│
├──────────────────────────┼─────────────────────────────┼───────────────┤
│ Category 1: Jellyfin     │ ▶  Play Now (Authorized)    │ ExoPlayer     │
│ Category 3: Archive MP4  │ ▶  Play Now (Authorized)    │ ExoPlayer     │
│ Category 2: OTT Provider │ Watch on [Provider Name] ↗  │ Deep-Link App │
│ Unlisted / General Guide │ Check OTT Availability in IN│ JustWatch Web │
└──────────────────────────┴─────────────────────────────┴───────────────┘
```

### 3.2 Verified Audio & Subtitle Language Box
* **Original Language:** Explicitly displays production language (e.g., `TE`, `TA`, `HI`).
* **Audio Track:**
  - If verified audio tracks exist in metadata: renders language list in green (`#38ef7d`).
  - If unverified: renders `Audio language information unavailable` in amber italics (`#ffa502`).
* **Subtitles:** Displays verified subtitle list or `Subtitle information unavailable`.

### 3.3 Interactive Multi-Provider Handoff Pills
Under the "Where to Watch in India" section:
* Groups availability into `Subscription`, `Free / Ad-Supported`, and `Rent or Buy`.
* Renders clickable pills (e.g. `[JioHotstar • Subscription ↗]`, `[Prime Video • Rent ↗]`).
* Tapping a pill validates URL safety and launches the provider's native Android app or browser destination.

---

## 4. ATTRIBUTION & RESILIENCE AUDIT

* **Attribution Notice:** Fixed footer on Browse and Details screens displays standard TMDB and JustWatch partner credits.
* **Network Advisory:** If the upstream TMDB API times out or is unconfigured, the Browse surface displays an advisory banner while keeping local Jellyfin, personal watchlist, offline downloads, and public-domain archive content fully functional.
