# STREAMLAB v1.2.0 — PHASE 19.3 PHYSICAL DEVICE ACCEPTANCE CHECKLIST

**Authority:** Android QA Lead / Physical Device Test Lead  
**Project:** VIDEO_STREAMING_APP — StreamLab  
**Target Hardware:** Android TV & Amazon Fire TV  
**Status:** `READY FOR EXECUTION — HARDWARE TEST PENDING APK PRODUCTION`  

---

## 1. DEVICE TEST PROTOCOL OVERVIEW

This checklist defines the forensic validation protocol for verifying StreamLab v1.2.0 preview APK on physical living-room devices via ADB sideloading.

### Target Test Devices:
1. **Android TV Reference Device:** (e.g., Google TV / Chromecast with Google TV / NVIDIA Shield TV / Sony Bravia) — Android TV OS 11, 12, or 14.
2. **Amazon Fire TV Reference Device:** (e.g., Fire TV Stick 4K Max / Fire TV Cube) — Fire OS 7 (Android 9 base) or Fire OS 8 (Android 11 base).

---

## 2. HARDWARE ACCEPTANCE MATRIX

| Step | Test Case | Sideload Procedure / Action | Expected Criteria | Result | Notes |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **01** | **ADB Installation** | `adb install -r StreamLab-preview-tv.apk` | Exit code `Success`, installs without permission error | `PENDING` | Verify signature acceptance |
| **02** | **Launcher Visibility** | Inspect TV Home Screen / Apps row | App icon visible in Leanback / Fire TV apps grid | `PENDING` | `LEANBACK_LAUNCHER` filter |
| **03** | **First Launch** | Click app banner with remote `Select` | Splash renders cleanly, no crash, enters Welcome/Home | `PENDING` | Verify no ANR |
| **04** | **D-Pad Navigation** | Press Up/Down/Left/Right on remote | Focus moves smoothly between cards, tabs, and rails | `PENDING` | Spatial navigation |
| **05** | **Focus Visibility** | Navigate through content items | High-contrast focus border/glow visible from 10 feet | `PENDING` | `focusable={true}` styling |
| **06** | **Back-Button Behavior** | Press remote `Back` button | Exits player to details, details to browse, prompts exit | `PENDING` | Native back handling |
| **07** | **Search Navigation** | Open Search screen, input query | On-screen TV keyboard or D-pad input works, results load | `PENDING` | Media type filters work |
| **08** | **Details Screen** | Select media item | Poster, synopsis, metadata, and Play button render | `PENDING` | Cast/overview layout |
| **09** | **Video Playback** | Select Play on VOD or Live channel | HLS stream plays smoothly with hardware decoding | `PENDING` | ExoPlayer native render |
| **10** | **Buffering Recovery** | Throttle network or jump stream | Buffering spinner displays and auto-recovers | `PENDING` | Error handling |
| **11** | **Audio Output** | Verify TV/Soundbar output | Audio in sync with video, no crackle or desync | `PENDING` | PCM / Dolby Digital |
| **12** | **Overscan & Safe Area**| Verify on 16:9 4K/1080p display | UI elements not clipped by TV bezel (5% TV safe zone) | `PENDING` | Landscape orientation lock |
| **13** | **App Exit & Relaunch** | Exit to TV home, relaunch app | Settings, language choice, and watch position retained | `PENDING` | SecureStore & SQLite |

---

## 3. TEST EXECUTION RECORD (TO BE POPULATED BY TESTER)

```text
================================================================================
PHYSICAL DEVICE ACCEPTANCE LOG
================================================================================
Device 1 (Android TV):
  Model: _______________________
  OS Version: __________________
  APK SHA-256: _________________
  Date: ________________________
  Tester: ______________________
  Result: [ ] PASS   [ ] FAIL

Device 2 (Fire TV):
  Model: _______________________
  Fire OS Version: _____________
  APK SHA-256: _________________
  Date: ________________________
  Tester: ______________________
  Result: [ ] PASS   [ ] FAIL
================================================================================
```

---
**Prepared By:** Android QA Lead  
**Date:** 2026-11-01  
