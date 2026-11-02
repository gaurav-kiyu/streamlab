# STREAMLAB v1.2.0 — PHASE 19.4 EAS BUILD PREFLIGHT REPORT

**Authority:** Principal Software Architect / DevSecOps Lead / Release Engineering Lead  
**Project:** `VIDEO_STREAMING_APP` — StreamLab v1.2.0  
**Workspace:** `D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-eas-link-temp`  
**Certified Local Commit:** `5eae23944de85c6b09303cfc704e9ba5393d15e9`  
**Canonical Branch:** `feat/phase-18-product-advancement`  
**Date:** 2026-11-01  
**Target Profile:** `preview-tv` (Android TV Preview APK)  
**Final Classification:** **`READY FOR EAS BUILD AUTHORIZATION`**

---

## 1. PREFLIGHT VERIFICATION MATRIX

| Verification Dimension | Expected Specification | Actual Evaluated State | Status | Evidence / Reference |
| :--- | :--- | :--- | :---: | :--- |
| **1. EAS Profile Configuration** | `preview-tv` defined with `EXPO_TV: "1"` | Confirmed in `mobile/eas.json` | **PASS** | Section 2.1 |
| **2. Artifact Build Type** | Standalone Android APK (`buildType: "apk"`) | `"buildType": "apk"` | **PASS** | Section 2.1 |
| **3. Project ID & Owner** | ID: `4955fcf0-41f0-44df-ac58-083f497a72ff`<br>Owner: `gaurav051987` | Verified in `app.json` & EAS CLI | **PASS** | Section 2.2 |
| **4. Android Package Identifier** | `com.streamlab.app` | Confirmed in `app.json` & Gradle config | **PASS** | Section 2.3 |
| **5. Application Versioning** | Version: `1.2.0`<br>VersionCode: `10200` | Aligned in `app.json` & dynamic config | **PASS** | Section 2.3 |
| **6. Leanback Launcher** | Intent filter with `LEANBACK_LAUNCHER` | Injected into `AndroidManifest.xml` | **PASS** | Section 2.4 |
| **7. SecureStore Backup Rules** | Full backup content exclusion | Verified `@xml/secure_store_backup_rules` | **PASS** | Section 2.5 |
| **8. Build Secrets & Environment** | Zero missing compile-time secrets | `EXPO_TV=1` set; 0 secrets required | **PASS** | Section 2.6 |
| **9. Lockfile Consistency** | Strict alignment with frozen baseline | Committed in `5eae239` (Exit Code 0) | **PASS** | Section 2.7 |
| **10. EAS Authentication** | Operator logged in with project access | `gaurav051987` (Role: Owner, Admin) | **PASS** | Section 2.8 |

---

## 2. DETAILED FORENSIC AUDIT

### 2.1 Profile Configuration (`mobile/eas.json`)
```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview-tv": {
      "distribution": "internal",
      "env": {
        "EXPO_TV": "1"
      },
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```
* **Evaluation:** Profile `preview-tv` specifies `distribution: "internal"` and `buildType: "apk"`. This produces an installable Android `.apk` suitable for sideloading via ADB to physical Android TV and Amazon Fire TV devices, rather than an `.aab` bundle designed for Google Play Store submission.
* **Environment Variable:** `EXPO_TV=1` is injected during EAS cloud build container execution, enabling React Native TV layout mode.

### 2.2 Project Identification & EAS Association
* **Local Declaration (`mobile/app.json`):**
  ```json
  "extra": {
    "eas": {
      "projectId": "4955fcf0-41f0-44df-ac58-083f497a72ff"
    }
  },
  "owner": "gaurav051987"
  ```
* **Remote EAS API Query (`npx eas-cli project:info`):**
  * `fullName`: `@gaurav051987/streamlab`
  * `ID`: `4955fcf0-41f0-44df-ac58-083f497a72ff`
* **Evaluation:** The local Expo configuration is 100% synchronized with the registered EAS cloud project.

### 2.3 Android Identity & Versioning
* **Package Name:** `com.streamlab.app`
* **Marketing Version:** `1.2.0`
* **Internal Version Code:** `10200`
* **Dynamic Validation (`npx expo config --type public`):**
  Evaluated with Exit Code 0, confirming that the Android manifest generator receives `version: "1.2.0"` and `versionCode: 10200`.

### 2.4 Android TV Leanback Launcher
* **Declared Intent Filters (`mobile/app.json`):**
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
* **Prebuild Manifest Verification (`AndroidManifest.xml`):**
  ```xml
  <category android:name="android.intent.category.LAUNCHER"/>
  <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>
  ```
* **Evaluation:** Enables the StreamLab banner and launcher tile on the Android TV Leanback home row and Fire TV home screen.

### 2.5 SecureStore Backup Exclusion Rules
* **Plugin Attachment:** `["expo-secure-store", { "faceIDPermission": "Allow StreamLab to securely unlock parental controls." }]`
* **Prebuild Manifest Verification (`AndroidManifest.xml`):**
  ```xml
  <application
      android:fullBackupContent="@xml/secure_store_backup_rules"
      android:dataExtractionRules="@xml/secure_store_data_extraction_rules" ...>
  ```
* **Evaluation:** Prevents encrypted parental PINs, auth tokens, and cryptographic keys stored in Android KeyStore / EncryptedSharedPreferences from being leaked into unencrypted Google Cloud backups.

### 2.6 Build Environment & Secrets Analysis
* **EAS Secrets Query (`npx eas-cli secret:list`):**
  * Empty set (0 secrets).
* **EAS Environment Variables Query (`npx eas-cli env:list preview`):**
  * `No variables found for this environment.`
* **Application Source Code Audit:**
  * Searched `mobile/App.js` and `mobile/src/**/*.js` for `process.env`: **0 occurrences found**.
  * StreamLab mobile uses client-side settings, user runtime configuration, and local encrypted storage. No secrets or external environment variables are required during cloud compilation.

### 2.7 Dependency & Lockfile Consistency
* **Certified Commit:** `5eae23944de85c6b09303cfc704e9ba5393d15e9`
* **Lockfile Integrity:** `package-lock.json` is clean, tracked, and committed on `feat/phase-18-product-advancement`.
* **Dependency Tree Check (`npm ls expo react react-native --all`):**
  * `expo@52.0.49`
  * `react-native@0.76.9`
  * `react@18.3.1`
  * `expo-secure-store@14.0.1`
  * `@react-navigation/native@6.1.18`
  * Exit Code: 0 (0 invalid packages).

### 2.8 EAS Authentication & Permissions
* **Identity:** `gaurav051987` (`ai.auto.gaurav@gmail.com`)
* **Role:** Owner / Admin
* **Project Access:** Owner of `@gaurav051987/streamlab` (`4955fcf0-41f0-44df-ac58-083f497a72ff`).
* **Evaluation:** The authenticated operator possesses the necessary cloud permissions to dispatch and manage EAS builds.

---

## 3. STRICT BOUNDARY & CHANGE CONTROL

* **Application Source Code:** 0 modifications made.
* **Dependencies:** 0 modifications made.
* **Cloud Build Submission:** **NOT EXECUTED** (`CLOUD_BUILD_AUTHORIZED = FALSE`).
* **Remote Push:** Not executed.

---

## 4. FINAL CLASSIFICATION & GOVERNANCE DECISION

```text
================================================================================
FINAL CLASSIFICATION: READY FOR EAS BUILD AUTHORIZATION
================================================================================
```

The preflight audit confirms that all technical prerequisites, cloud associations, manifest configurations, and asset pipelines are aligned for the Android TV Preview APK build.

### Proposed Execution Command (Awaiting Authorization):
```powershell
cd mobile
npx eas-cli build --profile preview-tv --platform android
```
