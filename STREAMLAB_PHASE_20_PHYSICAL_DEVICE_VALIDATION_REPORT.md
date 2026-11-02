# STREAMLAB v1.2.0 — PHASE 20 PHYSICAL DEVICE VALIDATION REPORT

**Authority:** Principal Software Architect / Android TV QA Lead / Application Security Lead  
**Project:** `VIDEO_STREAMING_APP` — StreamLab v1.2.0  
**Workspace:** `D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-eas-link-temp`  
**Certified Git Revision:** `5eae23944de85c6b09303cfc704e9ba5393d15e9`  
**Target APK:** `build-artifacts/streamlab-v1.2.0-preview-tv.apk`  
**Date:** 2026-11-01  
**Classification:** **`D — INSTALLATION OR RUNTIME BLOCKED`** (Awaiting Physical Device ADB Connection)

---

## 1. EXECUTIVE SUMMARY & GATE DECISION

In accordance with Phase 20 governance, forensic validation of the compiled Android TV APK and physical device discovery were executed:

1. **Phase 20.1 (Artifact Forensic Validation):** **100% PASSED**.
   * Recalculated SHA-256 matches the certified hash bit-for-bit.
   * Cryptographic signature verified using Android SDK `apksigner` (v2 APK Signature Scheme, RSA 2048-bit).
   * Package metadata extracted via `aapt dump badging`: confirms `com.streamlab.app`, `versionCode='10200'`, `versionName='1.2.0'`, `minSdkVersion='24'`, `targetSdkVersion='34'`.
   * Native code verified across all four Android TV ABIs: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` (Universal FAT binary).
   * `leanback-launchable-activity` is explicitly declared and bound to `com.streamlab.app.MainActivity`.

2. **Phase 20.2 (Device Discovery):** **BLOCKED**.
   * ADB daemon initiated (`Android Debug Bridge version 1.0.41`, build `37.0.0-14910828`).
   * Device query (`adb devices -l`) returned **zero connected devices**.
   * In strict accordance with change control instructions:
     > *"Do not assume an emulator is equivalent to physical Android TV hardware. If no physical device is connected, stop and produce device-connection instructions. Do not invent a device IP address. Do not fabricate test results."*
   * Phases 20.3 through 20.8 are paused until the human operator pairs the physical Android TV or Amazon Fire TV device.

---

## 2. PHASE 20.1 — ARTIFACT FORENSIC VALIDATION MATRIX

| Forensic Check | Requirement | Evaluated Result | Verdict |
| :--- | :--- | :--- | :---: |
| **1. APK Existence** | Must exist at declared path | Confirmed at `build-artifacts/streamlab-v1.2.0-preview-tv.apk` | **PASS** |
| **2. File Size** | ~63–67 MB | `66,740,271 bytes` (~63.64 MB) | **PASS** |
| **3. SHA-256 Checksum** | `CDD6B50E7A441213C51D1E85CE9E3DC0621C53E3DED998ADDA33A79267FBA673` | Recalculated: `CDD6B50E7A441213C51D1E85CE9E3DC0621C53E3DED998ADDA33A79267FBA673` | **PASS** |
| **4. ZIP Archive Integrity** | Valid PK header signature | Hex: `50 4B 03 04` | **PASS** |
| **5. Signature Verification** | `apksigner.bat verify --verbose` | `Verifies: true`<br>Scheme: `v2 (APK Signature Scheme v2)`<br>Key Algorithm: `RSA (2048 bits)`<br>Digest: `6dc9eaa0e5f7dffaea8cc167ca16d9dc4725c08691c04ea6080781c9fac407e0` | **PASS** |
| **6. Package Identifier** | `com.streamlab.app` | Confirmed via `aapt dump badging` | **PASS** |
| **7. Version Alignment** | `versionName: 1.2.0`<br>`versionCode: 10200` | `versionName='1.2.0'`<br>`versionCode='10200'` | **PASS** |
| **8. Android SDK Levels** | Minimum Android 7.0 (API 24)<br>Target Android 14 (API 34) | `sdkVersion:'24'`<br>`targetSdkVersion:'34'`<br>`compileSdkVersion:'35'` | **PASS** |
| **9. Leanback Launcher** | Intent filter category | `leanback-launchable-activity: name='com.streamlab.app.MainActivity'` | **PASS** |
| **10. CPU Architectures** | Support 32-bit & 64-bit TV chips | `native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'` | **PASS** |

---

## 3. PHASE 20.2 — DEVICE DISCOVERY TELEMETRY

```powershell
$env:PATH = "C:\Users\gaura\AppData\Local\Android\Sdk\platform-tools;" + $env:PATH
adb.exe version
adb.exe devices -l
```

### Raw Output:
```text
Android Debug Bridge version 1.0.41
Version 37.0.0-14910828
Installed as C:\Users\gaura\AppData\Local\Android\Sdk\platform-tools\adb.exe
Running on Windows 10.0.26300
* daemon not running; starting now at tcp:5037
* daemon started successfully
List of devices attached
<empty>
```

### Telemetry Findings:
* **Attached Devices:** 0
* **ADB Host Status:** Healthy (ADB Daemon v1.0.41 listening on `tcp:5037`).
* **Root Cause:** No physical television, streaming box, or Fire TV Stick is currently paired or connected over USB / Wi-Fi ADB.

---

## 4. RUNBOOK: CONNECTING PHYSICAL ANDROID TV / FIRE TV VIA ADB

To resume automated installation and test execution (Phases 20.3 to 20.8), connect your living-room device to your local network and execute the pairing commands below:

### Option A: Standard Android TV / Google TV (Sony, TCL, Mi Box, Chromecast)
1. On your TV, navigate to **Settings** → **System** (or **Device Preferences**) → **About**.
2. Scroll to **Android TV OS Build** and click the **Select/OK** button on your remote **7 times** until a toast announces: *"You are now a developer!"*
3. Return to **Settings** → **System** → **Developer Options**.
4. Enable **USB Debugging** (and **Network Debugging** if available).
5. Obtain the TV's IP address: **Settings** → **Network & Internet** → Select active Wi-Fi / Ethernet connection → Note IP (e.g. `192.168.1.150`).
6. On your PC terminal, run:
   ```powershell
   $env:PATH = "C:\Users\gaura\AppData\Local\Android\Sdk\platform-tools;" + $env:PATH
   adb connect <TV_IP_ADDRESS>:5555
   ```
7. A prompt will appear on your TV screen: *"Allow USB debugging?"* — Check **"Always allow from this computer"** and select **OK**.

### Option B: Amazon Fire TV Stick / Fire TV Cube (FireOS)
1. On your Fire TV, go to **Settings** → **My Fire TV** → **About**.
2. Highlight your device name and click the **Select** button **7 times** to unlock Developer Options.
3. Return to **Settings** → **My Fire TV** → **Developer Options**.
4. Turn **ADB Debugging** to **ON**.
5. Check **Settings** → **My Fire TV** → **About** → **Network** to note the Fire TV IP address.
6. On your PC terminal, run:
   ```powershell
   $env:PATH = "C:\Users\gaura\AppData\Local\Android\Sdk\platform-tools;" + $env:PATH
   adb connect <FIRE_TV_IP_ADDRESS>:5555
   ```
7. Accept the authorization dialog on your TV.

### Option C: Direct USB Cable Connection
* Connect a USB-A to USB-C (or Micro-USB) cable from your PC to the TV / Streaming Box maintenance port.
* Enable USB Debugging in Developer Options.

---

## 5. SUBSEQUENT VALIDATION PIPELINE (UPON CONNECTION)

Once `adb devices -l` outputs an authorized physical device, the following test phases will automatically execute:

* **Phase 20.3:** `adb install -r build-artifacts/streamlab-v1.2.0-preview-tv.apk` and `dumpsys package` audit.
* **Phase 20.4:** Clean launch test via `adb shell monkey -p com.streamlab.app 1`, cold start timing, splash screen verification, and logcat crash scanning.
* **Phase 20.5:** Automated D-Pad key event simulation (`KEYCODE_DPAD_UP`, `DOWN`, `LEFT`, `RIGHT`, `CENTER`, `BACK`, `HOME`) to test focus rings and living-room navigation.
* **Phase 20.6:** Functional inspection of Live TV playback, VOD streaming, EPG guide association, and SecureStore encryption.
* **Phase 20.7 & 20.8:** Memory footprint, background/resume lifecycle, and ANR verification.

---

## 6. CLASSIFICATION & GATE STATUS

```text
================================================================================
STATUS: D — INSTALLATION OR RUNTIME BLOCKED
REASON: NO PHYSICAL ANDROID TV DEVICE CONNECTED VIA ADB
ARTIFACT STATUS: 100% CERTIFIED (SHA-256 MATCHED, APKSIGNER V2 VERIFIED)
================================================================================
```

Execution is halted awaiting physical device connection.
