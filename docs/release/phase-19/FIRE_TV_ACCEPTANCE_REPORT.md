# STREAMLAB v1.2.0 — AMAZON FIRE TV ACCEPTANCE REPORT

**Authority:** Senior QA Automation Lead / Fire OS Platform Specialist  
**Document ID:** FTR-PHASE19-FTV-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Overall Acceptance Status:** `BLOCKED_EXTERNAL`  

---

## 1. DEVICE TARGET & FIRE OS ENVIRONMENT AUDIT

### 1.1 Target Device Specification Requirements
Amazon Fire TV devices run Fire OS, a proprietary fork of the Android Open Source Project (AOSP). Certification requires verification on genuine Fire TV hardware:
* **Target Hardware:** Amazon Fire TV Stick 4K (2nd Gen), Fire TV Stick 4K Max, or Fire TV Cube (3rd Gen).
* **Target Operating System:**
  - Fire OS 7 (derived from Android 9.0 Pie / API Level 28).
  - Fire OS 8 (derived from Android 11.0 / API Level 30).
* **Input Controller:** Alexa Voice Remote (3rd Gen) with physical navigation D-pad, Select button, Back button, Home button, Menu button, and Play/Pause button.
* **App Store Guidelines:** Compliance with Amazon Appstore Content Policy and Fire TV Remote Navigation Guidelines.

### 1.2 Host Environment ADB Probe
* **Command Executed:**
  ```powershell
  & "C:\Users\gaura\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
  ```
* **Host ADB Output:**
  ```
  List of devices attached
  (No attached devices detected)
  ```
* **Audit Finding:** Zero Amazon Fire TV devices are currently connected via USB or wireless debugging (`adb connect <firetv-ip>:5555`).
* **Governance Rule Applied:** Emulators and Android TV device profiles cannot stand in for genuine Fire OS verification due to Fire OS-specific lifecycle behaviors, proprietary media pipeline modifications, and Amazon Leanback overlay rules.

---

## 2. FIRE TV TEST EXECUTION MATRIX (FTV-01 – FTV-13)

| Test ID | Test Case | Target Expected Result | Execution Status | Evidence Required for Gate Closure |
| :--- | :--- | :--- | :---: | :--- |
| **FTV-01** | APK installation | `adb install -r streamlab-firetv-release.apk` succeeds without package parsing error. | `BLOCKED_EXTERNAL` | ADB install console output showing `Success` and APK SHA-256 hash. |
| **FTV-02** | Application launch | App opens to full screen from Amazon Fire TV launcher without ANR dialog. | `BLOCKED_EXTERNAL` | `adb logcat -s ActivityManager:I` showing successful component launch. |
| **FTV-03** | Remote navigation | Alexa Voice Remote D-pad moves active focus across home rows and category strips. | `BLOCKED_EXTERNAL` | Screenshot showing focused item visual elevation and accent border. |
| **FTV-04** | Select button | Pressing SELECT button activates focused tile, opening player or content view. | `BLOCKED_EXTERNAL` | Key event log capturing `KEYCODE_DPAD_CENTER` / `KEYCODE_ENTER`. |
| **FTV-05** | Back button | BACK button returns to previous screen; back at root displays exit prompt. | `BLOCKED_EXTERNAL` | Screen capture showing navigation stack pop and custom exit dialogue. |
| **FTV-06** | EPG navigation | Guide matrix responds to vertical and horizontal remote inputs smoothly. | `BLOCKED_EXTERNAL` | Frame drop metric log (`adb shell dumpsys gfxinfo com.streamlab.app`). |
| **FTV-07** | Channel switching | Selecting adjacent channel changes stream within <1.5 seconds without crash. | `BLOCKED_EXTERNAL` | Media pipeline logs displaying stream disconnect and re-attach timestamps. |
| **FTV-08** | Mini-player | Video continuity maintained in mini-player while browsing guide or settings. | `BLOCKED_EXTERNAL` | Screencap verifying mini-player overlay with concurrent UI navigation. |
| **FTV-09** | Fullscreen | Fullscreen transition expands video to 16:9 aspect ratio without letterbox skew. | `BLOCKED_EXTERNAL` | Frame capture verifying 1920x1080 display geometry without aspect distortion. |
| **FTV-10** | HLS playback | HLS Live and VOD streams decode smoothly using Fire TV MediaCodec hardware. | `BLOCKED_EXTERNAL` | Codec log verifying hardware accelerated H.264/HEVC decoding. |
| **FTV-11** | MPEG-TS playback | Direct MPEG-TS transport stream decodes cleanly if hardware codec is available. | `BLOCKED_EXTERNAL` | Audio/video synchronization measurement and frame render rate. |
| **FTV-12** | Network interruption | Graceful reconnection handling when network fluctuates; no unhandled crash. | `BLOCKED_EXTERNAL` | Reconnection event log confirming exponential backoff and buffer restore. |
| **FTV-13** | Extended playback | 60+ minutes continuous live playback without audio drift or out-of-memory fault. | `BLOCKED_EXTERNAL` | Process memory log (`dumpsys meminfo`) confirming stable native heap. |

---

## 3. PHYSICAL QA RUNBOOK FOR FIRE TV LAB

When physical Amazon Fire TV hardware is available in the test lab:

```bash
# 1. Enable Developer Options & ADB Debugging on Fire TV:
# Settings -> My Fire TV -> Developer Options -> ADB Debugging -> ON
# Settings -> My Fire TV -> Developer Options -> Apps from Unknown Sources -> ON

# 2. Connect via ADB over Wi-Fi
adb connect 192.168.1.xxx:5555
adb devices

# 3. Verify Fire OS build fingerprint
adb shell getprop ro.build.version.fireos
adb shell getprop ro.build.version.name
adb shell getprop ro.product.model

# 4. Sideload verified signed release APK
adb install -r streamlab-firetv-release.apk

# 5. Stream real-time logs
adb logcat -v threadtime -s StreamLab:V AmazonFireTV:V MediaCodec:V > firetv_run_evidence.log

# 6. Execute FTV-01 through FTV-13 test cases using Alexa Voice Remote
# 7. Collect screen captures
adb exec-out screencap -p > firetv_evidence.png
```

---

## 4. ACCEPTANCE CONCLUSION

* **Executed Tests:** 0 / 13 (Host missing physical Amazon Fire TV device).
* **Passed Tests:** 0 / 13.
* **Blocked Tests:** 13 / 13 (`BLOCKED_EXTERNAL`).
* **Hardware Gate Status:** `BLOCKED_EXTERNAL`.
