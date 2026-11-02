# STREAMLAB v1.2.0 — AMAZON FIRE TV BUILD COMPATIBILITY REPORT

**Authority:** Senior Fire OS Platform Engineer / Quality Assurance Lead  
**Document ID:** FTBC-PHASE19.1-FTV-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Configuration Compatibility Status:** `VERIFIED_READY_FOR_BUILD`  
**Hardware Runtime Status:** `PENDING_PHYSICAL_DEVICE_TEST`  

---

## 1. FIRE OS COMPATIBILITY & ARCHITECTURAL FOUNDATION

Amazon Fire TV devices operate on Fire OS, derived from AOSP:
* **Fire OS 7:** Based on Android 9.0 Pie (API Level 28). Matches StreamLab's `minSdkVersion: 28`.
* **Fire OS 8:** Based on Android 11.0 (API Level 30). Fully supported by StreamLab's `targetSdkVersion: 34`.

### Zero Google Play Services Dependency:
StreamLab was audited for third-party service couplings:
* **Authentication & Networking:** StreamLab relies on standard native fetch / REST APIs over HTTPS.
* **Storage & Encryption:** Uses `@react-native-async-storage/async-storage` and `expo-secure-store` (backed by Android Keystore), which function identically on Fire OS without Google Mobile Services (GMS).
* **Push Notifications:** No Firebase Cloud Messaging (FCM) hard crashes are present in the core media path.

---

## 2. APK INSTALLATION & SIDELOADING REQUIREMENTS

* **Package Format:** Direct `.apk` binary output (produced via `eas.json` profile `preview-tv`). Fire OS does not accept Android App Bundles (`.aab`) for local sideloading via ADB.
* **Signature Requirements:** Signed with APK Signature Scheme v2/v3.
* **Amazon Fire TV Launcher Integration:** The declaration of `android.intent.category.LEANBACK_LAUNCHER` ensures the application tile is registered under "Your Apps & Channels" on the Fire TV home screen.

---

## 3. ALEXA VOICE REMOTE INTERFACE & NAVIGATION MAPPING

* **Directional Pad (D-pad):** Fire TV remote dispatches standard Android key events (`KEYCODE_DPAD_UP`, `KEYCODE_DPAD_DOWN`, `KEYCODE_DPAD_LEFT`, `KEYCODE_DPAD_RIGHT`). StreamLab's focus engine handles these natively.
* **Select Button:** Maps directly to `KEYCODE_DPAD_CENTER` / `KEYCODE_ENTER` to open media cards and toggle playback.
* **Back Button:** Dispatches `KEYCODE_BACK`. StreamLab's React Navigation stack captures the back event cleanly, retreating up the view hierarchy without unexpected app exits.

---

## 4. MEDIA CODEC & PLAYBACK COMPATIBILITY

* **ExoPlayer Architecture:** The underlying `react-native-video` (v6.4.4) player leverages ExoPlayer on Android/Fire TV.
* **Hardware Video Decoders:** Amazon Fire TV Stick 4K hardware decodes H.264 (AVC Baseline/Main/High up to Level 5.2) and H.265 (HEVC Main 10 Profile up to Level 5.1). StreamLab's Live TV and Jellyfin profiles negotiate compatible bitrates and codecs (`mobile/test/client.test.js` Test 2).

---

## 5. COMPATIBILITY CONCLUSION

* **Configuration & Codebase Readiness:** `VERIFIED_READY_FOR_BUILD`
* **Compilation Profile Recommendation:** Build with EAS profile `preview-tv` (`EXPO_TV=1`).
* **Physical Device Clearance:** Pending execution of test suite FTV-01 through FTV-13 on physical Amazon Fire TV Stick 4K hardware.
