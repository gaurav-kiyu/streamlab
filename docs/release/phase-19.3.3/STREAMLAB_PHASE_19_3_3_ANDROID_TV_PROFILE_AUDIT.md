# STREAMLAB v1.2.0 — PHASE 19.3.3 ANDROID TV PROFILE AUDIT

**Authority:** Android Release Engineer / QA Lead  
**Project:** VIDEO_STREAMING_APP — StreamLab  
**Date:** 2026-11-01  
**Target Profile:** `preview-tv`  

---

## 1. PROFILE SPECIFICATION AUDIT

The `preview-tv` profile configured in `mobile/eas.json` and root `eas.json` defines:

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

### Analysis of Technical Configuration:
* **`distribution: "internal"`:** Directs EAS to generate standalone preview artifacts without submitting to the Google Play Store developer console.
* **`android.buildType: "apk"`:** Directs Gradle to compile a standalone installable Android Package (`.apk`) rather than an Android App Bundle (`.aab`). This is essential for ADB sideloading onto Android TV and Amazon Fire TV devices.
* **`env.EXPO_TV: "1"`:** Documented in previous phases as a legacy unconsumed flag. It does not alter React Native 0.76.2 core binaries.

---

## 2. ANDROID TV RUNTIME READINESS

| Component | Technical Mechanism | Audit Finding | Status |
| :--- | :--- | :--- | :---: |
| **Launcher Visibility** | `LEANBACK_LAUNCHER` intent filter | Present in generated AndroidManifest.xml | **PASS** |
| **Hardware Decoding** | React Native Video (ExoPlayer) | Bound in dependencies (`^6.4.4`) | **PASS** |
| **TV D-Pad Navigation**| AOSP focus traversal (`focusable={true}`) | Focusable tags present on interactive elements | **PASS** |
| **Secure Credentials** | Android KeyStore via `expo-secure-store` | Rules injected into AndroidManifest.xml | **PASS** |
| **Leanback Banner** | `android.banner` (`320x180` PNG) | Missing from `app.json` configuration | **RECOMMENDED** |
| **Touchscreen Guard** | `touchscreen required="false"` | Omitted (Not required for ADB sideloading) | **COMPLIANT** |

---

## 3. SUITABILITY FOR INTERNAL PREVIEW RELEASE

The `preview-tv` profile is structurally suitable for generating an internal preview APK for living-room sideload validation, subject to resolving the missing branding assets and completing EAS project association.

---
**Verdict:** ANDROID TV PROFILE VALIDATED FOR SIDELOAD ARTIFACT GENERATION  
**Audited By:** Android Release Engineer  
