# STREAMLAB v1.2.0 — PHASE 20.4 & 20.5
# CONTROLLED LOCAL COMMIT AND EAS CLOUD BUILD REPORT

**Authority:** Release Engineering / Principal Software Architect / QA Lead  
**Package:** `com.streamlab.app`  
**Target Version:** `1.2.0` (versionCode: `10200`)  
**Branch:** `feat/phase-18-product-advancement`  
**Certified Baseline Commit:** `5eae23944de85c6b09303cfc704e9ba5393d15e9`  
**Execution Date:** 2026-11-02  
**Final Verdicts:**  
- **Phase 20.4 (Local Git Commit):** **`PASSED`**  
- **Phase 20.5 (EAS Cloud Build):** **`CLASSIFICATION A — FINISHED & CERTIFIED`**

---

## 1. PHASE 20.4 — CONTROLLED LOCAL GIT COMMIT

### 1.1 Pre-Commit State Audit
Prior to staging and committing, the working tree was verified against baseline commit `5eae23944de85c6b09303cfc704e9ba5393d15e9`:
- Tracked modified files: Exactly 1 (`mobile/App.js`).
- Pre-staged diff: Confirmed the exact 2-line remediation (`import { registerRootComponent } from "expo";` and `registerRootComponent(App);`).
- Preserved diagnostics: All logcat dumps (`streamlab-crash.txt`, `streamlab-full-log.txt`) and phase reports remained intact and untouched.

### 1.2 Commit Execution Telemetry

| Parameter | Certified Value | Verification Method |
| :--- | :--- | :--- |
| **Branch** | `feat/phase-18-product-advancement` | `git branch --show-current` |
| **New Commit SHA** | `cae7a8cac0ede9e29dedef73bc28c78740704f5f` | `git rev-parse HEAD` |
| **Parent Commit SHA** | `5eae23944de85c6b09303cfc704e9ba5393d15e9` | `git rev-parse HEAD~1` |
| **Commit Message** | `fix(mobile): invoke expo registerRootComponent to resolve Android launch crash` | `git log -1 --format=%B` |
| **Committed Files** | `mobile/App.js` ONLY | `git show --stat HEAD` |
| **Diff Metrics** | 1 file changed, 3 insertions(+), 0 deletions(-) | `git diff HEAD~1..HEAD` |
| **Author / Committer** | Antigravity Engineering `<engineering@streamlab.local>` | `git log -1 --format=fuller` |
| **Timestamp** | 2026-11-02T09:46:26+05:30 | ISO Commit Date |

### 1.3 Exact Committed Patch
```diff
diff --git a/mobile/App.js b/mobile/App.js
index 9a3247b..6effe12 100644
--- a/mobile/App.js
+++ b/mobile/App.js
@@ -1,4 +1,5 @@
 import React, { useEffect, useState } from "react";
+import { registerRootComponent } from "expo";
 import { Alert, StatusBar, Text, View, Platform } from "react-native";
 import { NavigationContainer, DarkTheme } from "@react-navigation/native";
 import { createNativeStackNavigator } from "@react-navigation/native-stack";
@@ -206,3 +207,5 @@ export default function App() {
     </SafeAreaProvider>
   );
 }
+
+registerRootComponent(App);
```

### 1.4 Post-Commit Working Tree Verification
- Staged changes: None (`git diff --cached` is empty).
- Tracked modified files: None (`git status --short` has zero tracked modifications).
- **Phase 20.4 Gate:** **`PASSED`**.

---

## 2. PHASE 20.5 — EXACTLY ONE EAS CLOUD APK BUILD

### 2.1 Build Execution Telemetry

| Parameter | Certified Value | Verification Method |
| :--- | :--- | :--- |
| **EAS Build ID** | `01c18ea5-b283-4245-8b6a-14ad5007a2b3` | EAS Cloud Worker Registry |
| **Build Status** | **`FINISHED`** | `npx eas-cli build:view --json` |
| **EAS Project** | `@gaurav051987/streamlab` (`4955fcf0-41f0-44df-ac58-083f497a72ff`) | EAS REST API |
| **Platform** | `ANDROID` | EAS Worker Container |
| **Build Profile** | `preview-tv` | `eas.json` Profile Definition |
| **Build Type** | `apk` (Internal Distribution APK) | `eas.json` Android Target |
| **Environment Variable** | `EXPO_TV=1` | EAS Profile Injected Env |
| **Source Git Commit** | `cae7a8cac0ede9e29dedef73bc28c78740704f5f` | EAS Build Context Git Hash |
| **Project Fingerprint** | `6ab1c0cf7e71a8eae4d7ed662499b71dd2f55a62` | EAS Fingerprint Engine |
| **Submission Timestamp** | `2026-11-02T04:19:21.382Z` (09:49:21 IST) | EAS `createdAt` |
| **Completion Timestamp** | `2026-11-02T04:26:39.937Z` (09:56:39 IST) | EAS `completedAt` |
| **Build Duration** | **7 minutes 18 seconds** (432,389 ms build duration) | EAS Metrics Log |
| **Logs URL** | [https://expo.dev/accounts/gaurav051987/projects/streamlab/builds/01c18ea5-b283-4245-8b6a-14ad5007a2b3](https://expo.dev/accounts/gaurav051987/projects/streamlab/builds/01c18ea5-b283-4245-8b6a-14ad5007a2b3) | Public/Console URL |

---

## 3. ARTIFACT DOWNLOAD & FORENSIC CERTIFICATION

### 3.1 Local Artifact Storage & Hashes
The generated APK was retrieved directly from Expo Application Services and archived in `build-artifacts`:

| Artifact Attribute | Certified Specification |
| :--- | :--- |
| **Remote Artifact URL** | `https://expo.dev/artifacts/eas/9PS9ITU4RYxI37kaFDD_8MR0VeTDkONQnsAHozYZLkc.apk` |
| **Local Path** | `D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-eas-link-temp\build-artifacts\streamlab-v1.2.0-preview-tv-remediated.apk` |
| **Exact File Size** | **`66,789,343 bytes`** (63.69 MB) |
| **SHA-256 Digest** | **`E22515647EFD31FE8A85C23483F73926009AB81583C9ECC6D004BDAF59EB8C70`** |
| **ZIP File Structure** | Validated. Contains `AndroidManifest.xml`, `classes.dex`, `assets/index.android.bundle`. |

### 3.2 Cryptographic Signature Verification (`apksigner`)
Verified using Android SDK Build-Tools 31.0.0 `apksigner.bat verify --verbose --print-certs`:

```text
Verifies
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): false
Verified using v4 scheme (APK Signature Scheme v4): false
Verified for SourceStamp: false
Number of signers: 1
Signer #1 certificate DN: CN=, OU=, O=, L=, ST=, C=US
Signer #1 certificate SHA-256 digest: 6dc9eaa0e5f7dffaea8cc167ca16d9dc4725c08691c04ea6080781c9fac407e0
Signer #1 key algorithm: RSA
Signer #1 key size (bits): 2048
```
- **Signing Result:** `Verifies` with **APK Signature Scheme v2**.
- **Signer #1 SHA-256:** `6dc9eaa0e5f7dffaea8cc167ca16d9dc4725c08691c04ea6080781c9fac407e0`.
- **Identity Note:** The certificate digest matches the release signing keystore from the baseline build.

### 3.3 Android Manifest & Badging Audit (`aapt`)
Verified using `aapt.exe dump badging`:

```text
package: name='com.streamlab.app' versionCode='10200' versionName='1.2.0' compileSdkVersion='35' compileSdkVersionCodename='15'
application-label:'StreamLab'
launchable-activity: name='com.streamlab.app.MainActivity'  label='' icon=''
leanback-launchable-activity: name='com.streamlab.app.MainActivity'  label='' icon='' banner=''
```
- **Application Package:** `com.streamlab.app` (Match)
- **Marketing Version:** `1.2.0` (Match)
- **VersionCode:** `10200` (Match)
- **Compile SDK Version:** `35` (Android 15)
- **Mobile Launcher Support:** Standard Android `LAUNCHER` registered for `com.streamlab.app.MainActivity`.
- **TV Launcher Support:** Android TV `LEANBACK_LAUNCHER` registered for `com.streamlab.app.MainActivity`.

---

## 4. GOVERNANCE AND INTEGRITY AUDIT

In strict compliance with release governance instructions:
1. **Local Commits:** Exactly ONE local Git commit (`cae7a8cac0ede9e29dedef73bc28c78740704f5f`) was created.
2. **EAS Cloud Builds:** Exactly ONE EAS build (`01c18ea5-b283-4245-8b6a-14ad5007a2b3`) was submitted.
3. **No Remote Push:** No `git push` was performed. Working branch remains local.
4. **No Deployment:** No Play Store or production submission was executed.
5. **Dependency Integrity:** Zero dependencies were updated, installed, or modified.
6. **Diagnostic Integrity:** All diagnostic files (`streamlab-crash.txt`, `streamlab-full-log.txt`) remain intact.
7. **Execution Boundary:** No installation to the physical device has been performed.

---

## 5. FINAL CLASSIFICATION & RECOMMENDATION

### Classification:
- **Phase 20.4 (Local Git Commit):** **`PASSED`**
- **Phase 20.5 (EAS Cloud Build):** **`A — EAS build FINISHED, APK downloaded, package/version verified, signing verification passed, SHA-256 recorded`**

### Ready for Next Phase:
The remediated APK artifact is downloaded, cryptographically verified, and ready in `build-artifacts`:
- `build-artifacts/streamlab-v1.2.0-preview-tv-remediated.apk`

**STOPPING AS MANDATED.**  
Awaiting explicit human authorization before proceeding to physical device installation or Phase 20.6.

---
*Report certified by Release Engineering & Principal Software Architect.*
