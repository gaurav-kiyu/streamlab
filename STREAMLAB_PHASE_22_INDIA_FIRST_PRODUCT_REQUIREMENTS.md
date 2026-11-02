# STREAMLAB v1.2.0 — PHASE 22.1
# INDIA-FIRST PRODUCT REQUIREMENTS SPECIFICATION

**Authority:** Product Engineering Lead / India OTT Research Lead / Principal Software Architect  
**Date:** November 2, 2026  
**Status:** APPROVED & IMPLEMENTED  
**Application:** StreamLab v1.2.0 (`com.streamlab.app`)  
**Target Market:** India (`IN`) & Global Indian Diaspora  

---

## 1. PRODUCT VISION & CORE PHILOSOPHY

### 1.1 The Problem Statement
Mainstream commercial OTT aggregators and international streaming applications default to Hollywood and Western-centric media catalogs. Users across India—speaking eleven major constitutional languages and consuming cinema from distinct regional film industries—are routinely forced to manually configure filters, navigate multiple siloed apps, and conduct redundant searches across fragmented platforms just to find relevant Indian content.

### 1.2 The StreamLab Value Proposition
StreamLab v1.2.0 establishes an **India-First Content Discovery Architecture**. Upon first launch following onboarding, the application immediately greets the user with:

> **"Indian Entertainment — All Your Languages, All Your Platforms."**

The platform functions as a unified, rights-respecting multi-OTT guide and personal media hub, prioritizing regional Indian cinematic and episodic storytelling by default without requiring manual country or language selection.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STREAMLAB INDIA-FIRST DEFAULTS                       │
├────────────────────────────┬───────────────────────────────────────────┤
│ Target Country / Region    │ IN (India)                                │
│ Default Content Language   │ All Indian Languages (11 Regional Tongues)│
│ Default Ranking / Sorting  │ Popularity in India (sort_by=pop.desc)    │
│ Primary Discover Surface   │ Curated Indian Thematic & Regional Shelves│
└────────────────────────────┴───────────────────────────────────────────┘
```

---

## 2. REGIONAL INDIAN LANGUAGE SUPPORT

### 2.1 Language Taxonomy Matrix
StreamLab supports 11 primary Indian languages covering over 95% of domestic entertainment consumption, while strictly preserving the 10 existing UI localization languages:

| Language | ISO 639-1 Code | Native Script | Film / Content Industry | TMDB Filter Code | UI Localization | Content Discovery |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| **All India** | `all` | भारत | Pan-Indian Combined | `hi\|ta\|te\|ml\|kn\|bn\|mr\|pa\|gu\|as\|or` | N/A | **Default** |
| **Hindi** | `hi` | हिन्दी | Bollywood, Hindi Web Series | `hi` | Supported | Supported |
| **Tamil** | `ta` | தமிழ் | Kollywood, Tamil Series | `ta` | Supported | Supported |
| **Telugu** | `te` | తెలుగు | Tollywood, Telugu Originals | `te` | Supported | Supported |
| **Malayalam** | `ml` | മലയാളം | Mollywood, Realistic Cinema | `ml` | Supported | Supported |
| **Kannada** | `kn` | ಕನ್ನಡ | Sandalwood, Kannada Cinema | `kn` | Supported | Supported |
| **Bengali** | `bn` | বাংলা | Tollywood (Bengal), Web Shows | `bn` | Supported | Supported |
| **Marathi** | `mr` | मराठी | Marathi Cinema & Natak | `mr` | Supported | Supported |
| **Punjabi** | `pa` | ਪੰਜਾਬੀ | Pollywood, Punjabi Hits | `pa` | Supported | Supported |
| **Gujarati** | `gu` | ગુજરાતી | Dhollywood, Urban Gujarati | `gu` | Supported | Supported |
| **Assamese** | `as` | অসমীয়া | Jollywood, Northeast Cinema | `as` | English UI Fallback | **Added (Phase 22)** |
| **Odia** | `or` | ଓଡ଼ିଆ | Ollywood, Odia Entertainment | `or` | English UI Fallback | **Added (Phase 22)** |

### 2.2 Strict Language Property Separation Rule
To eliminate false claims regarding dubbing and accessibility, the application enforces rigid data model boundaries:
1. **`original_language`**: The linguistic dialect in which the work was produced and filmed.
2. **`audio_languages`**: Verified additional audio dubs embedded in the stream or catalog.
3. **`subtitle_languages`**: Verified text caption tracks.

> [!CAUTION]
> **No Unsupported Dubbing Assumptions:** Never assume a blockbuster Telugu (e.g., *RRR* or *Pushpa*) or Kannada (*KGF*) title contains a Hindi audio track merely because it gained widespread popularity in northern states. Where explicit dubbing metadata is unavailable, StreamLab must render:
> `Audio: Audio language information unavailable`
> rather than making an unverified assertion.

---

## 3. REQUIRED HOME SCREEN SHELVES ARCHITECTURE

The Browse surface renders 9 distinct, sequential India-first shelves when `All India` (`all`) is selected:

### Section 1 — Trending in India
* **Trending Movies in India:** High-velocity box office and digital premieres across all 11 Indian languages.
* **Trending Indian Series:** Leading multi-platform web originals and television dramas.

### Section 2 — Hindi Entertainment
* **Hindi Blockbusters:** Major Bollywood releases and Hindi-language cinematic features.
* **Hindi Web Series & Originals:** Critical acclaim and digital-first episodic productions.

### Section 3 — South Indian Cinema
Dedicated, independent shelves honoring the four southern film industries:
* **Tamil Cinema Highlights (`ta`):** Contemporary Kollywood releases.
* **Telugu Cinema Highlights (`te`):** Pan-Indian and domestic Tollywood productions.
* **Malayalam Cinema Hits (`ml`):** Acclaimed Mollywood narratives.
* **Kannada Cinema Favorites (`kn`):** Groundbreaking Sandalwood releases.

### Section 4 — Regional Indian Cinema
Expands discovery beyond the metro hubs:
* **Bengali Cinema (`bn`)**
* **Marathi Cinema (`mr`)**
* **Punjabi Cinema (`pa`)**
* **Gujarati Cinema (`gu`)**
* **Assamese & Northeast Stories (`as`)**
* **Odia Cinema (`or`)**

### Section 5 — Available Across OTT Platforms
Live availability rows mapped to certified Indian streaming services:
* Popular on JioHotstar (`with_watch_providers=122`)
* Popular on Prime Video India (`with_watch_providers=119`)
* Available on SonyLIV & ZEE5 (`with_watch_providers=237|232`)

### Section 6 — Free Indian Entertainment
Verified legal, non-piracy sources:
* Free Indian movies (ad-supported and license-free titles via `with_watch_monetization_types=free|ads`).
* Internet Archive verified public-domain Hindi and regional classics.

### Section 7 — Indian Family and Kids
* Curated Indian animation, mythological epics, and family-safe entertainment (`with_genres=10751,16`).

### Section 8 — Indian Classics and Documentaries
* Golden-era cinema (pre-1995 classics from Satyajit Ray, Guru Dutt, Raj Kapoor, K. Balachander).
* Indian historical, cultural, and environmental documentaries (`with_genres=99`).

### Section 9 — Live Indian Television
* Integration with the existing Phase 16/17 Live TV & EPG engine, prioritizing authorized public-service and licensed feeds.

---

## 4. USER EXPERIENCE CRITERIA

1. **Immediate Discovery:** Initial app load renders Indian entertainment shelves in $< 1.2\text{s}$ without requiring a single user keystroke.
2. **One-Tap Dialect Switching:** Top-mounted horizontal chips enable immediate isolation of individual regional industries.
3. **Platform Quick-Pills:** Instant filtering by OTT provider or monetization type (Free, Subscription, Rent).
4. **Offline Resilience:** If upstream discovery APIs are offline or unconfigured, the app falls back gracefully to local Jellyfin and cached archive shelves with a clear user notice.
