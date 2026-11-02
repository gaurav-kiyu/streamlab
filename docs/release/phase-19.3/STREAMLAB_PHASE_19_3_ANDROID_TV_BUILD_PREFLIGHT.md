# STREAMLAB v1.2.0 — PHASE 19.3 ANDROID TV BUILD PREFLIGHT

**Authority:** Android Platform Engineer / Release Engineering Lead  
**Project:** VIDEO_STREAMING_APP — StreamLab  
**Date:** 2026-11-01  
**Target Profile:** `preview-tv`  
**Target Artifact:** Standalone Android TV APK  

---

## 1. BUILD PROFILE CONFIGURATION

The build profile `preview-tv` defined in `eas.json` (and `mobile/eas.json`) is configured as follows:

```json
"preview-tv": {
  "distribution": "internal",
  "env": {
    "EXPO_TV": "1"
  },
  "android": {
    "buildType": "apk"
  }
}
```

### Profile Technical Parameters:
* **Output Format:** Standalone Android Package (`.apk`), required for sideload testing.
* **Distribution Scheme:** `internal` (bypasses Google Play Store bundle/AAB packaging).
* **Environment Variable:** `EXPO_TV=1`.
  * *Audit Finding:* `EXPO_TV=1` is an unconsumed legacy build flag in Expo SDK 52 / React Native 0.76.2. It does NOT independently pull in `react-native-tvos` or alter native runtime C++ binaries during EAS build. The application builds with standard React Native 0.76.2 AOSP Android components.

---

## 2. MANIFEST & TV PLATFORM CONTRACT

### 2.1 Leanback Launcher Intent
Expo configuration defines:
```json
"intentFilters": [
  {
    "action": "MAIN",
    "category": [
      "LAUNCHER",
      "LEANBACK_LAUNCHER"
    ]
  }
]
```
* **Leanback Verification:** Declaring `category: ["LAUNCHER", "LEANBACK_LAUNCHER"]` ensures that the compiled APK's AndroidManifest.xml contains an activity intent filter with `android.intent.category.LEANBACK_LAUNCHER`.
* **Home Screen Banner:** Allows the app icon to appear on the Android TV and Fire TV home screen launcher row upon sideloading.

### 2.2 Sideload vs Store Distribution Matrix

| Requirement | Sideload via ADB (Preview APK) | Google Play Store TV Track | Amazon Fire TV Appstore |
| :--- | :--- | :--- | :--- |
| **Artifact Type** | Standalone APK (`buildType: "apk"`) | App Bundle (`.aab`) | Standalone APK (`.apk`) |
| **Leanback Intent Filter** | Required for launcher icon | Required | Recommended |
| **Touchscreen Required=False** | Not required (AOSP ignores) | **Mandatory** | Recommended |
| **Leanback Banner Asset** | Fallback to adaptive icon | **Mandatory** (`320x180` banner) | Recommended |
| **Signing Certificate** | EAS managed debug/ad-hoc keystore | Play App Signing / Upload Key | Amazon Developer Key |

---

## 3. BUILD PREFLIGHT RISK AUDIT

1. **Config Plugin Resolution:**  
   During local invocation of `eas-cli project:info`, the local mock file `mobile/node_modules/expo-secure-store/index.js` caused `Package "expo-secure-store" does not contain a valid config plugin`.  
   *Preflight Note:* On EAS cloud builders, `expo-secure-store` is fetched from npm as the genuine upstream package, which contains Expo's valid autolinking config plugin. However, during local prebuilds, mock directories inside `node_modules` interfere with CLI operations.
2. **Standard React Native AOSP Focus:**  
   The build uses standard React Native 0.76.2. D-pad navigation relies on AOSP native focus traversal (`hasTVPreferredFocus`, `focusable={true}`). Actual remote behavior on Amazon Fire TV (Fire OS 7/8) and Android TV (API 28-34) must be validated on physical hardware.

---
**Preflight Assessment:** PROFILE VALID FOR SIDELOAD APK BUILD  
**Audited By:** Android Platform Engineer  
