# STREAMLAB v1.2.0 — PHASE 19.2 ANDROID TV BUILD PROFILE AUDIT

**Authority:** Senior Android Platform Engineer / Release Engineering Lead  
**Document ID:** BPR-PHASE19.2-PROFILE-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Inspected File:** `mobile/eas.json` (SHA-256: `DDC146B2A3EFB57449FDBCEBC0AE8C4BF37B274602A32E1C23AD68ADFCECE3EF`)  

---

## 1. `preview-tv` BUILD PROFILE SPECIFICATION

The target build profile in `mobile/eas.json` was audited:

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

### Profile Attributes:
1. **Output Format:** `"buildType": "apk"`. Produces a standalone, sideloadable `.apk` package instead of an `.aab` (Android App Bundle). This is the mandatory format for direct ADB sideload testing on Android TV and Amazon Fire TV.
2. **Distribution Type:** `"distribution": "internal"`. Configured for ad-hoc internal distribution, downloading directly from `expo.dev`.
3. **Environment Flag:** `"EXPO_TV": "1"`. Retained as a declared profile environment variable. As established in Phase 19.1B/19.1C, this is an unconsumed legacy flag in Expo SDK 52 without `@react-native-tvos/config-tv`. **It does not modify native compilation, and no `react-native-tvos` fork is introduced.**
4. **Inheritance & Credentials:** Profile operates in self-contained configuration; signing credentials will be managed by EAS cloud keystores upon authentication.

---

## 2. ANDROID MANIFEST RECONCILIATION CLASSIFICATION

A detailed classification of Android manifest elements was conducted to distinguish sideload requirements from store ingestion requirements:

| Manifest Element / Feature | Classification | Technical Rationale & Current Project Status |
| :--- | :---: | :--- |
| **`LEANBACK_LAUNCHER`** | **REQUIRED FOR SIDELOADING & TV LAUNCH** | **Present in `app.json`.** Instructs Android TV and Fire TV OS to display the application tile in the TV launcher app row. |
| **`LAUNCHER`** | **REQUIRED FOR PHONE / TABLET COMPATIBILITY** | **Present in `app.json`.** Preserves universal multi-device installation across standard mobile and tablet screens. |
| **`android.hardware.touchscreen` (`required="false"`)** | **REQUIRED FOR GOOGLE PLAY TV DISTRIBUTION** | **Not declared in `app.json`.** Sideloading via ADB works on 100% of TV devices without it. However, Google Play Store's automated ingestion checks for `touchscreen required="false"` when targeting the TV track. |
| **`android.software.leanback`** | **RECOMMENDED** | **Omitted in `app.json`.** Helpful for hybrid app store discoverability, but not required for direct ADB sideloading. |
| **TV Launcher Banner Artwork (`android:banner`)** | **RECOMMENDED** | **Omitted in `app.json`.** Modern Android TV (Android 8+) and Fire OS display square adaptive icons cleanly when a 16:9 landscape banner is not supplied. |
| **Orientation (`"orientation": "default"`)** | **NEEDS VERIFICATION ON TV HARDWARE** | **Present in `app.json`.** Corrects earlier assumption: `"default"` (AOSP `unspecified`) does not hardcode a 16:9 lock in manifest. Instead, it respects the hardware display's native orientation (which is landscape on TV panels). |
| **Minimum SDK (`minSdkVersion: 28`)** | **REQUIRED** | **Present in `app.json`.** Guarantees compatibility with Android 9.0+ and Fire OS 7+. |
| **Target SDK (`targetSdkVersion: 34`)** | **REQUIRED** | **Present in `app.json`.** Meets modern Android 14 requirements. |

---

## 3. AUDIT CONCLUSION

The `preview-tv` build profile is properly configured for the immediate objective: producing an unencumbered, standalone `.apk` for physical device sideload testing on Android TV and Amazon Fire TV.
