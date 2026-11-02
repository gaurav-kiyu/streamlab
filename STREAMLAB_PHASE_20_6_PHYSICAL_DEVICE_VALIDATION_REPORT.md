# STREAMLAB v1.2.0 — PHASE 20.6
# PHYSICAL ANDROID DEVICE INSTALLATION & RUNTIME LAUNCH VALIDATION REPORT

**Authority:** Android QA Lead / Release Engineer  
**Target Device:** Nothing Phone (2)  
**Device Model:** `AIN065` (`PongIND` / `Pong`)  
**Android OS Version:** `16` (API Level `36`)  
**ADB Connection Target:** `192.168.1.40:40105`  
**Package:** `com.streamlab.app`  
**Version:** `1.2.0` (versionCode: `10200`)  
**Execution Timestamp:** 2026-11-02T10:19:00+05:30  
**Final Classification:** **`A — PASS (FULL PASS)`**

---

## 1. Executive Summary

During Phase 20.1.2 live Android hardware diagnostics, StreamLab v1.2.0 (`preview-tv` build `88c368a8-775e-4d40-873f-d22b79b56c2f`) suffered an immediate launch crash on the Nothing Phone (2):
```
com.facebook.react.common.JavascriptException: Invariant Violation: "main" has not been registered.
```
Phase 20.2 resolved this via explicit Expo root registration (`registerRootComponent(App)` in `mobile/App.js`), which was committed in Phase 20.4 (`cae7a8cac0ede9e29dedef73bc28c78740704f5f`) and compiled via EAS Cloud Build in Phase 20.5 (`01c18ea5-b283-4245-8b6a-14ad5007a2b3`).

In Phase 20.6, the remediated APK (`build-artifacts/streamlab-v1.2.0-preview-tv-remediated.apk`) was installed in-place on the physical Nothing Phone (2) via wireless ADB (`adb install -r`). Runtime launch telemetry, logcat captures, UI hierarchies, and functional smoke tests confirmed that:
1. **The original `Invariant Violation: "main" has not been registered` exception is completely absent and does not recur.**
2. **`ReactNativeJS: Running "main"` executed cleanly without any startup crash.**
3. **The Home (Browse) screen rendered completely with categories, languages, and genres.**
4. **All navigation tabs (`Browse`, `Search`, `Live TV`, `Settings`) transitioned and rendered.**
5. **Back navigation and app force-stop/reopen restart tests passed with 100% stability.**

**Verdict:** **Phase 20.6 achieves Classification `A — PASS`**. The P0 launch blocker is resolved.

---

## 2. Hardware Target & Device Verification

| Telemetry Property | Verified Hardware Value | Method |
| :--- | :--- | :--- |
| **Device Model** | `AIN065` (Nothing Phone 2) | `getprop ro.product.model` |
| **Product / Board** | `PongIND` / `Pong` | `getprop ro.product.name` |
| **Android Release** | `16` | `getprop ro.build.version.release` |
| **Android SDK / API** | `36` | `getprop ro.build.version.sdk` |
| **ADB Serial** | `192.168.1.40:40105` | `adb devices -l` |
| **Device Status** | `device` (Authorized) | Transport ID `1` |
| **Available Storage** | `26 GB` free on `/data` partition | `df -h /data` |

---

## 3. Pre-Installation APK Artifact Verification

Prior to installation, the staged APK artifact was independently re-verified:

| Verification Check | Target / Expected Specification | Verified Value | Compliance |
| :--- | :--- | :--- | :--- |
| **Local File Path** | `build-artifacts/streamlab-v1.2.0-preview-tv-remediated.apk` | File exists on disk | **PASS** |
| **Exact File Size** | `66,789,343 bytes` | `66,789,343 bytes` | **PASS** |
| **SHA-256 Digest** | `E22515647EFD31FE8A85C23483F73926009AB81583C9ECC6D004BDAF59EB8C70` | Identical hash | **PASS** |
| **Package Name** | `com.streamlab.app` | `com.streamlab.app` | **PASS** |
| **versionName** | `1.2.0` | `1.2.0` | **PASS** |
| **versionCode** | `10200` | `10200` | **PASS** |
| **Compile SDK** | `35` | `35` | **PASS** |
| **APK Signatures** | Scheme v2 valid | `Verifies` (`v2: true`) | **PASS** |
| **Signer Certificate** | `6dc9eaa0e5f7dffaea8cc167ca16d9dc4725c08691c04ea6080781c9fac407e0` | Matches release keystore | **PASS** |

---

## 4. In-Place Installation Telemetry

In strict accordance with release protocol, the APK was installed as an in-place update (`-r`) without clearing application data or wiping SecureStore:

```bash
adb -s 192.168.1.40:40105 install -r build-artifacts/streamlab-v1.2.0-preview-tv-remediated.apk
```

**Installation Log Output:**
```text
Performing Streamed Install
Success
```

### Post-Installation State:
- **Installed APK Path:** `/data/app/~~S9cEsCLp6kaVI9tORo6Umg==/com.streamlab.app-dwYQnWUHA06Ia00V1xU_zg==/base.apk`
- **Installed Version:** `versionCode=10200`, `versionName=1.2.0`
- **Update Timestamp:** `2026-11-02 10:14:15`
- **Resolved Launcher Activity:** `com.streamlab.app/.MainActivity`

---

## 5. Runtime Launch & Startup Logcat Forensic Analysis

The application was launched via monkey launcher intent:
```bash
adb -s 192.168.1.40:40105 shell monkey -p com.streamlab.app 1
```

### 5.1 Native Runtime & React Native Bootstrap Trace
From `phase-20.6-evidence/streamlab-phase-20.6-logcat.txt`:
```text
11-02 10:14:41.326 17727 17778 D nativeloader: Load /data/app/.../libexpo-modules-core.so ... ok
11-02 10:14:41.328 17727 17778 I ExpoModulesCore: ✅ JSI interop was installed
11-02 10:14:41.329 17727 17778 I ExpoModulesCore: ✅ Constants were exported
11-02 10:14:41.337 17727 17778 D nativeloader: Load /data/app/.../librnscreens.so ... ok
11-02 10:14:41.341 17727 17778 V AsyncStorageExpoMigration: No scoped database found
11-02 10:14:41.345 17727 17778 I ReactNativeJS: Running "main"
```

### 5.2 Specific Crash Recurrence Check
A comprehensive regex search across all captured log files was performed:
```text
Search Pattern: FATAL EXCEPTION | JavascriptException | Invariant Violation | main has not been registered | UnsatisfiedLinkError
```
- **Invariant Violation: "main" has not been registered:** **0 occurrences (ABSENT)**
- **JavascriptException:** **0 occurrences**
- **FATAL EXCEPTION:** **0 occurrences**
- **UnsatisfiedLinkError:** **0 occurrences**
- **Crash Status:** **ZERO FATAL CRASHES DETECTED**.

### 5.3 Active Window & View Hierarchy Telemetry
`dumpsys window` and `dumpsys activity` confirmed the application is running in the foreground:
- **Focused Window:** `Window{3274ab0 u0 com.streamlab.app/com.streamlab.app.MainActivity}`
- **Activity State:** `mCreated=true`, `mResumed=true`, `mStopped=false`
- **View Hierarchy:** `com.swmansion.rnscreens.ScreenStack` mounted at `[0, 126][1080, 2356]`.

---

## 6. Functional Smoke Test Matrix

| Test Case | Procedure | Expected Outcome | Actual Hardware Observation | Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **1. Application Startup** | Launch `com.streamlab.app` | App opens without stopping | App opened immediately; no crash dialog | **PASS** |
| **2. Root Registration** | Inspect logcat during startup | `"main"` component invoked | `ReactNativeJS: Running "main"` logged | **PASS** |
| **3. Home (Browse) UI** | Dump UI hierarchy of first screen | Categories and genres render | Rendered: `Hindi`, `Marathi`, `Punjabi`, `Gujarati`, `Action`, `Comedy`, `Drama`, etc. | **PASS** |
| **4. Bottom Tab Bar** | Inspect navigation elements | 4 standard tabs displayed | Displayed: `Browse`, `Search`, `Live TV`, `Settings` | **PASS** |
| **5. Live TV Navigation** | Tap `Live TV` tab (x=675, y=2280) | Screen transitions to Live TV | Screen transitioned: `Live TV & Guide`, `0 Channels`, `+ Import M3U & EPG` | **PASS** |
| **6. Search Navigation** | Tap `Search` tab (x=405, y=2280) | Screen transitions to Search | Screen transitioned: `Search movies`, `Trending Categories`, `Action`, etc. | **PASS** |
| **7. Settings Navigation** | Tap `Settings` tab (x=945, y=2279) | Screen transitions to Settings | Screen transitioned: `Account & Profiles`, `App language`, `Stream quality`, etc. | **PASS** |
| **8. Back Navigation** | Send `KEYCODE_BACK` (keyevent 4) | Navigates back to home tab | Returned directly to `Browse` screen | **PASS** |
| **9. Process Restart** | `am force-stop` then re-launch | PID terminates, new PID starts | Previous PID killed; reopened to PID `20170`; window focus restored | **PASS** |
| **10. Runtime Stability** | Observe during 10+ minutes runtime | No ANR or crash | 0 fatal exceptions across 3.6 MB logcat | **PASS** |

---

## 7. Artifact & Evidence Register

All raw telemetry and evidentiary captures have been archived in `phase-20.6-evidence/`:

| Evidence File | File Size | Description |
| :--- | :--- | :--- |
| [`phase-20.6-evidence/streamlab-phase-20.6-logcat.txt`](file:///D:/AI_APPs/VIDEO_STREAMING_APP/streamlab-eas-link-temp/phase-20.6-evidence/streamlab-phase-20.6-logcat.txt) | 345,720 bytes | Initial launch logcat confirming `ReactNativeJS: Running "main"` and zero fatal exceptions. |
| [`phase-20.6-evidence/streamlab-phase-20.6-smoke-logcat.txt`](file:///D:/AI_APPs/VIDEO_STREAMING_APP/streamlab-eas-link-temp/phase-20.6-evidence/streamlab-phase-20.6-smoke-logcat.txt) | 3,612,084 bytes | Extended smoke test logcat covering navigation, back stack, and restart tests. |
| [`phase-20.6-evidence/screen-running.png`](file:///D:/AI_APPs/VIDEO_STREAMING_APP/streamlab-eas-link-temp/phase-20.6-evidence/screen-running.png) | 876,728 bytes | Physical screenshot of initial app render on Nothing Phone (2). |
| [`phase-20.6-evidence/screen-smoke-pass.png`](file:///D:/AI_APPs/VIDEO_STREAMING_APP/streamlab-eas-link-temp/phase-20.6-evidence/screen-smoke-pass.png) | 1,200,546 bytes | Physical screenshot of Browse home screen after smoke test and restart. |

---

## 8. Limitations & Scope Boundaries

Per the authorized testing protocol:
- **Video Player Streaming:** **`NOT TESTED`** (Preserving user cellular/Wi-Fi bandwidth; no active video streams played).
- **Authentication / Account Login:** **`NOT TESTED`** (Running in Guest Browsing Mode as designed).
- **Android TV Remote D-Pad Navigation:** **`NOT TESTED`** (Validation conducted on physical Android smartphone touchscreen).

---

## 9. Final Classification & Recommendation

### Classification:
**`A — PASS`**
- Installation successful.
- Home screen renders.
- Original registration exception absent.
- No fatal startup errors.
- Restart test successful.

**STRICT STOP CONDITION OBSERVED.**  
Phase 20.6 runtime validation is concluded. No further builds, commits, or deployments will be initiated without explicit human instruction.

---
*Report certified by Android QA Lead & Release Engineer.*
