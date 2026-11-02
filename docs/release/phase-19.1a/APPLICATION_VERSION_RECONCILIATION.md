# STREAMLAB v1.2.0 — APPLICATION VERSION RECONCILIATION

**Authority:** Principal Software Architect / Release Engineering Lead  
**Document ID:** AVR-PHASE19.1A-VERSIONS-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Audit Finding:** `VERSION METADATA DISCREPANCY IDENTIFIED — RECONCILIATION REQUIRED`  

---

## 1. VERSION METADATA INVENTORY & AUDIT

An audit of all manifest, configuration, and build descriptor files across the monorepo was executed:

| Configuration File | Inspected Field | Current Declared Value | Intended Milestone Target | Consistency Verdict |
| :--- | :--- | :---: | :---: | :---: |
| **`package.json` (Root)** | `"version"` | `1.2.0` | `1.2.0` | **CONSISTENT** |
| **`mobile/package.json`** | `"version"` | `1.2.0` | `1.2.0` | **CONSISTENT** |
| **`server/package.json`** | `"version"` | `1.2.0` | `1.2.0` | **CONSISTENT** |
| **`mobile/app.json`** | `"expo.version"` | **`0.2.0`** | `1.2.0` | **DISCREPANCY** |
| **`mobile/app.json`** | `"expo.android.versionCode"`| **`1`** | `10200` | **DISCREPANCY** |
| **`mobile/app.json`** | `"expo.ios.buildNumber"` | `"1"` | `1.2.0` | **DISCREPANCY** |
| **`mobile/eas.json`** | Build profile version overrides | *None configured* | N/A | **INHERITS APP.JSON** |

---

## 2. METADATA FIELD CONTROLS & IMPACT ANALYSIS

### 2.1 Which field controls the displayed application version?
* **Controlling Field:** `expo.version` in `mobile/app.json`.
* **Mechanism:** In the Expo / React Native Android build pipeline, Expo prebuild maps `expo.version` directly into Android's `versionName` in `build.gradle` and `AndroidManifest.xml`.
* **Runtime Impact:** If built as currently configured, the Android OS Settings, App Info screen, Google TV Leanback launcher details, and store listings will display **`0.2.0`**.

### 2.2 Which field controls Android package version metadata?
* **Controlling Field:** `expo.android.versionCode` in `mobile/app.json`.
* **Mechanism:** Maps to `defaultConfig.versionCode` in Android's Gradle configuration and the `android:versionCode` attribute of the `<manifest>` tag.
* **Current State:** Declared as `1`.

### 2.3 Which field controls Android upgrade compatibility?
* **Controlling Field:** `expo.android.versionCode`.
* **Mechanism:** Android's `PackageManagerService` enforces that any replacement APK installed via `adb install -r` or app store updates must possess a `versionCode >= current installed versionCode`.
* **Impact:** A `versionCode` of `1` permits fresh installations, but lacks semantic spacing for milestone progression.

### 2.4 Does the existing EAS configuration override any values?
* **Audit Finding:** **No.** `mobile/eas.json` does not declare `appVersion`, `versionCode`, or `"autoIncrement"`. EAS Build strictly inherits the values present in `mobile/app.json`.

### 2.5 Does this discrepancy affect the intended v1.2.0 release?
* **YES.** Building without addressing this discrepancy produces binaries that internally claim to be version `0.2.0` with `versionCode: 1`. This directly contradicts:
  - `STREAMLAB_V1_2_0_ENGINEERING_FREEZE_RECORD.md`
  - Monorepo `package.json` declarations (`1.2.0`)
  - Formal Phase 18 and Phase 19 audit records.
  - QA validation criteria (`aapt dump badging` will fail release criteria).

---

## 3. RECOMMENDED CANONICAL VERSIONING POLICY

To resolve this discrepancy, the following canonical versioning policy is formally recommended:

```json
{
  "expo": {
    "name": "StreamLab",
    "slug": "streamlab",
    "version": "1.2.0",
    "android": {
      "package": "com.streamlab.app",
      "versionCode": 10200
    },
    "ios": {
      "bundleIdentifier": "com.streamlab.app",
      "buildNumber": "10200"
    }
  }
}
```

### Rationale for `versionCode: 10200`:
* Scheme: `MAJOR * 10000 + MINOR * 100 + PATCH`
* For `v1.2.0`: $1 \times 10000 + 2 \times 100 + 0 = 10200$
* Leaves space for up to 99 patch releases (`10201` for `1.2.1`) and provides immediate clarity in device logs (`adb shell dumpsys package com.streamlab.app | grep versionCode`).

---

## 4. GOVERNANCE AUTHORIZATION REQUIREMENT

Because `mobile/app.json` is a tracked file under the engineering freeze, updating `"version": "1.2.0"` and `"versionCode": 10200` requires explicit human authorization.
