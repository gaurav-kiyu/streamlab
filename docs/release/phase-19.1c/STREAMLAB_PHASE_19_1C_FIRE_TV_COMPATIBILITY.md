# STREAMLAB v1.2.0 — FIRE TV COMPATIBILITY & LIFECYCLE AUDIT

**Authority:** Senior Fire OS Specialist / QA Lead  
**Document ID:** FTC-PHASE19.1C-FIRETV-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Classification:** `ARCHITECTURE FEASIBLE — PHYSICAL DEVICE TESTING MANDATORY`  

---

## 1. FIRE OS VERSION & API COMPATIBILITY AUDIT

StreamLab's minimum SDK bounds (`minSdkVersion: 28`) were audited against active Amazon Fire TV models:

| Fire TV Device Generation | Active Fire OS Version | Base Android AOSP Version | API Level | StreamLab API Compatibility |
| :--- | :---: | :---: | :---: | :---: |
| **Fire TV Stick (3rd Gen) / Lite** | Fire OS 7 | Android 9.0 Pie | API 28 | **SUPPORTED** (`minSdkVersion: 28`) |
| **Fire TV Stick 4K (1st Gen)** | Fire OS 6 | Android 7.1 Nougat | API 25 | **UNSUPPORTED** (Requires API 28+) |
| **Fire TV Stick 4K (2nd Gen)** | Fire OS 8 | Android 11.0 | API 30 | **SUPPORTED** (`minSdkVersion: 28`) |
| **Fire TV Stick 4K Max (1st/2nd Gen)**| Fire OS 7 / 8 | Android 9.0 / 11.0 | API 28 / 30 | **SUPPORTED** (`minSdkVersion: 28`) |
| **Fire TV Cube (2nd / 3rd Gen)** | Fire OS 7 / 8 | Android 9.0 / 11.0 | API 28 / 30 | **SUPPORTED** (`minSdkVersion: 28`) |
| **Fire TV Smart TVs (Omni / 4-Series)**| Fire OS 7 / 8 | Android 9.0 / 11.0 | API 28 / 30 | **SUPPORTED** (`minSdkVersion: 28`) |

### Finding:
StreamLab supports all modern Fire TV devices running Fire OS 7 or 8 (API 28+). Older legacy devices on Fire OS 6 (API 25) are strictly excluded by `minSdkVersion: 28`. Universal Fire TV compatibility is **not claimed**.

---

## 2. SUBSYSTEM RUNTIME COMPATIBILITY ANALYSIS

### 2.1 Alexa Voice Remote & Input Key Delivery
* **D-pad Navigation:** The Alexa Voice Remote dispatches standard Android keycodes (`DPAD_UP`, `DOWN`, `LEFT`, `RIGHT`, `CENTER`). Handled cleanly by Android's native `FocusFinder` and React Native's `focusable={true}` implementation.
* **On-Screen Keyboard & Text Input:** On Fire TV, tapping text input in `Search.js` launches Amazon's system virtual keyboard. Because StreamLab sets `autoFocus={!isTV}`, the keyboard is suppressed until the user explicitly selects the input box.
* **Voice Search Button:** The physical Alexa microphone button on the remote triggers the system-wide Alexa assistant overlay, pausing the app. Application resumes state via `AppState` listeners upon dismissal.

### 2.2 Security & Keystore Compatibility
* **`expo-secure-store`:** Encrypts user credentials and tokens using the Android Keystore system.
* **Fire OS Keystore Implementation:** Fire OS implements the standard Android KeyStore SPI backed by hardware TEE (TrustZone / Keymaster).
* **Classification:** **`CONFIGURATION_VERIFIED`**. Hardware execution on physical silicon is required to confirm vendor-specific keymaster quirks.

### 2.3 Memory & Lifecycle Risks on Fire TV Sticks
* **Memory Constraints:** Fire TV Stick Lite and Standard models possess only 1.0GB to 1.5GB of RAM.
* **Out-of-Memory (OOM) Risk:** Large EPG XMLTV guides (50MB+) parsed entirely in memory could trigger low-memory process kills by Fire OS's aggressive `lowmemorykiller`.
* **StreamLab Defense:** StreamLab's EPG parser was re-architected in Phase 17.1 to use SAX streaming in 500-record batches, bounding heap usage under 120MB (`server/test/epg-streaming.test.js` Tests 1–8).
* **Background/Foreground Transition:** When the user presses Home, Fire OS backgrounds the app. `LivePlayer.js` detaches the native ExoPlayer instance to free hardware decoders immediately, preventing OOM terminations.

---

## 3. AUDIT CONCLUSION

Fire OS compatibility is architecturally sound for Fire OS 7 and 8 devices. Due to Fire OS-specific memory ceilings and proprietary remote overlays, physical testing on an actual Fire TV Stick 4K remains an **external prerequisite** before release authorization.
