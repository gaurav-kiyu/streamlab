# STREAMLAB v1.2.0 — AMAZON FIRE TV RUNTIME COMPATIBILITY AUDIT

**Authority:** Senior Fire OS Platform Engineer / QA Automation Lead  
**Document ID:** FTRC-PHASE19.1A-FTV-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Overall Runtime Status:** `CONFIGURATION COMPLIANT — PHYSICAL VALIDATION BLOCKED`  

---

## 1. FIRE OS RUNTIME & OS LEVEL AUDIT

Amazon Fire TV devices operate on Fire OS, derived from the Android Open Source Project (AOSP):
* **Fire OS 7:** Based on Android 9.0 Pie (API Level 28). Directly aligned with `mobile/app.json` (`minSdkVersion: 28`).
* **Fire OS 8:** Based on Android 11.0 (API Level 30). Fully supported by `targetSdkVersion: 34`.

---

## 2. NATIVE DEPENDENCY & GMS INDEPENDENCE AUDIT

Amazon Fire TV devices strictly lack Google Mobile Services (GMS) and Google Play Services. An audit of native dependencies in `mobile/package.json` confirms:

| Dependency | Purpose | GMS Dependency | Fire OS Compatibility Verdict |
| :--- | :--- | :---: | :---: |
| **`expo-secure-store`** | Hardware Keystore storage for client tokens | **None** | **COMPATIBLE** (Uses Android Keystore provider) |
| **`@react-native-async-storage`** | Local persistent key-value cache | **None** | **COMPATIBLE** (Uses SQLite/native files) |
| **`react-native-video`** | ExoPlayer video pipeline | **None** | **COMPATIBLE** (Uses AOSP ExoPlayer) |
| **`react-native-screens`** | Native navigation fragments | **None** | **COMPATIBLE** (Uses standard Android FragmentActivity) |
| **`expo-file-system`** | Cache storage & M3U parsing buffer | **None** | **COMPATIBLE** (Uses standard Android storage) |

### Finding:
StreamLab contains **zero hard dependencies on Google Play Services**. The media player, cryptographic store, and navigation operate cleanly on AOSP and Fire OS.

---

## 3. REMOTE CONTROL EVENT ARCHITECTURE (ALEXA VOICE REMOTE)

The Fire TV remote control dispatches standard Android key events to the active `Activity`:
* **Directional Navigation:**
  - `KEYCODE_DPAD_UP` (19)
  - `KEYCODE_DPAD_DOWN` (20)
  - `KEYCODE_DPAD_LEFT` (21)
  - `KEYCODE_DPAD_RIGHT` (22)
  - *Handling:* Navigates focus across `focusable={true}` views in `LiveTvChannelList.js` and `ContentRow.js`.
* **Selection:**
  - `KEYCODE_DPAD_CENTER` (23) / `KEYCODE_ENTER` (66)
  - *Handling:* Activates focused channel card, launching `LivePlayer.js` or content detail modal.
* **Back Navigation:**
  - `KEYCODE_BACK` (4)
  - *Handling:* Intercepted by React Navigation `NavigationContainer`, popping the view stack before delegating to default exit.

---

## 4. HONEST CLASSIFICATION OF UNVERIFIED & UNSUPPORTED FEATURES

In accordance with strict release governance, unsupported or unverified features are honestly cataloged:

| Feature / Capability | Implementation Status | Fire TV Classification | Release Impact |
| :--- | :---: | :---: | :--- |
| **Sideloaded APK Installation** | Supported | `READY_FOR_TEST` | Can be installed via `adb install` or Downloader app. |
| **D-pad Navigation** | Supported | `READY_FOR_TEST` | Tested in unit mocks; physical remote test pending. |
| **HLS / MPEG-TS Playback** | Supported | `READY_FOR_TEST` | ExoPlayer decodes standard streams via MediaCodec. |
| **Amazon In-App Purchasing (IAP)**| Not Implemented | `UNSUPPORTED` | Not needed; StreamLab is 100% free streaming. |
| **In-App Alexa Voice Search** | Not Implemented | `UNSUPPORTED` | Voice search delegates to text chips; no Alexa Voice SDK. |
| **Amazon Appstore DRM Wrapper** | Not Implemented | `UNSUPPORTED` | Not needed; application contains no proprietary DRM. |
| **Physical Hardware Acceptance** | Not Executed | `BLOCKED_EXTERNAL` | Test suite FTV-01..13 requires physical Fire TV Stick. |

---

## 5. CONCLUSION

StreamLab v1.2.0 is architecturally compatible with Fire OS. The absence of GMS couplings ensures clean runtime stability. Hardware sign-off remains gated on physical testing (`BLOCKED_EXTERNAL`).
