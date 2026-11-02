# STREAMLAB v1.2.0 — ANDROID TV ACCEPTANCE REPORT

**Authority:** Senior QA Automation Lead / Android TV Systems Engineer  
**Document ID:** ATR-PHASE19-ATV-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Overall Acceptance Status:** `BLOCKED_EXTERNAL`  

---

## 1. DEVICE HARDWARE TARGET & ENVIRONMENT AUDIT

### 1.1 Target Device Specification Requirements
To satisfy release criteria for Android TV distribution, testing must be conducted against certified Android TV / Google TV reference hardware meeting the following profile:
* **Target Manufacturers:** Nvidia (Shield TV Pro), Sony (Bravia 4K TV), Chromecast with Google TV (4K), or Xiaomi (Mi Box 4K).
* **Target OS / API:** Android TV API 28 (Android 9.0) through API 34 (Android 14.0).
* **Reference UI:** Android TV Leanback Launcher (`android.intent.category.LEANBACK_LAUNCHER`).
* **Input Controller:** Standard Android TV Bluetooth / IR Remote Control with D-pad navigation, Center Select, Back, Home, and Media keys.
* **Display Output:** 1080p (1920x1080) and 4K UHD (3840x2160) @ 60Hz.

### 1.2 Host Environment ADB Device Probe
An automated ADB device scan was performed on the execution host:
* **Command Executed:**
  ```powershell
  & "C:\Users\gaura\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
  ```
* **Host ADB Output:**
  ```
  * daemon not running; starting now at tcp:5037
  * daemon started successfully
  List of devices attached
  (No attached devices detected)
  ```
* **Audit Finding:** Zero physical Android TV devices or network-paired TV endpoints are connected to the execution runner.
* **Governance Rule Applied:** Under strict governance protocols, automated emulator results, mock objects, and desktop simulations **cannot** be substituted for physical hardware verification. Missing hardware must not be converted into a passing result.

---

## 2. ANDROID TV TEST EXECUTION MATRIX (ATV-01 – ATV-18)

| Test ID | Test Case | Target Expected Result | Execution Status | Evidence Required for Gate Closure |
| :--- | :--- | :--- | :---: | :--- |
| **ATV-01** | APK installation | `adb install -r streamlab-tv-release.apk` succeeds with exit code 0 (`Success`). | `BLOCKED_EXTERNAL` | Terminal output of ADB installation log with APK SHA-256 hash. |
| **ATV-02** | Application launch | App launches from Leanback banner without ANR or fatal unhandled exception. | `BLOCKED_EXTERNAL` | `adb logcat -s AndroidRuntime:E ActivityManager:I` showing clean startup. |
| **ATV-03** | Initial screen | HeroBanner, ContentRow, and TV Navigation rail render at 1080p/4K TV DPI. | `BLOCKED_EXTERNAL` | Framebuffer capture (`adb exec-out screencap -p > atv_screen_init.png`). |
| **ATV-04** | D-pad up/down | Vertical D-pad moves focus smoothly between TV content rails and navigation rail. | `BLOCKED_EXTERNAL` | Input event log (`adb shell getevent`) and focus border UI screenshot. |
| **ATV-05** | D-pad left/right | Horizontal D-pad navigates cards in horizontal FlatList with smooth scroll snapping. | `BLOCKED_EXTERNAL` | Video recording of horizontal card carousel navigation without dropped frames. |
| **ATV-06** | Center/select | Pressing DPAD_CENTER opens details modal, starts video, or selects channel. | `BLOCKED_EXTERNAL` | Logcat confirming `KEYCODE_DPAD_CENTER` dispatched and processed by active view. |
| **ATV-07** | Back button | `KEYCODE_BACK` retreats one level up navigation stack; exits app only from root. | `BLOCKED_EXTERNAL` | Navigation hierarchy state log during consecutive back keypresses. |
| **ATV-08** | EPG navigation | `EPGTimeline` grid scrolls 2D matrix (channels vertical, timeline horizontal). | `BLOCKED_EXTERNAL` | Screenshot of focused EPG programme card with start/end time badge. |
| **ATV-09** | Channel selection | Selecting channel card tunes stream and updates active channel ID in state. | `BLOCKED_EXTERNAL` | Redux/Context state log confirming channel ID transition. |
| **ATV-10** | Channel switching | Rapid up/down channel switching transitions stream cleanly without audio overlap. | `BLOCKED_EXTERNAL` | AudioTrack logcat showing clean release of previous decoder session. |
| **ATV-11** | Mini-player | Exiting fullscreen live player transitions seamlessly into Picture-in-Guide mini-player. | `BLOCKED_EXTERNAL` | Screen capture showing continuous video rendering in PiP container during guide browsing. |
| **ATV-12** | Fullscreen transition | DPAD_CENTER on mini-player expands player to 100% viewport without re-buffering. | `BLOCKED_EXTERNAL` | Video recording of seamless fullscreen expansion without frame stutter. |
| **ATV-13** | HLS playback | HLS stream playback initializes native hardware decoder, rendering video + audio. | `BLOCKED_EXTERNAL` | `dumpsys media.player` confirming active MediaCodec Surface and AudioTrack output. |
| **ATV-14** | MPEG-TS playback | Direct MPEG-TS transport stream decodes cleanly if hardware codec is available. | `BLOCKED_EXTERNAL` | Codec capabilities report and audio/video sync offset measurement. |
| **ATV-15** | Audio controls | Remote volume and mute keys adjust audio output without app interruption. | `BLOCKED_EXTERNAL` | AudioManager volume change broadcast log verification. |
| **ATV-16** | Network interruption | Disconnecting Ethernet/Wi-Fi triggers retry overlay; reconnect auto-resumes playback. | `BLOCKED_EXTERNAL` | Logcat showing network connectivity drop, exponential retry, and stream recovery. |
| **ATV-17** | Extended playback | 60+ minutes continuous Live TV playback without memory leak, thermal throttle or crash. | `BLOCKED_EXTERNAL` | `adb shell dumpsys meminfo com.streamlab.app` before and after 60-min run. |
| **ATV-18** | App background/foreground | Home button backgrounds app and frees audio/video decoders; resume restores state. | `BLOCKED_EXTERNAL` | Lifecycle logs (`onPause`, `onStop`, `onResume`) with decoder release verification. |

---

## 3. PHYSICAL QA RUNBOOK FOR EXTERNAL DEVICE LAB

When physical Android TV reference devices are provisioned, the QA team must execute the following protocol to unblock Gate G-05:

```bash
# 1. Connect target Android TV over ADB
adb connect <android-tv-ip>:5555
adb devices

# 2. Verify device architecture and Android TV API level
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.model

# 3. Sideload verified signed release APK
adb install -r streamlab-tv-release.apk

# 4. Stream logcat to local audit file
adb logcat -v time -s StreamLab:V LivePlayer:V MediaCodec:V AudioTrack:V > atv_run_evidence.log

# 5. Execute ATV-01 through ATV-18 test suite using physical remote control
# 6. Capture screen state after each step
adb exec-out screencap -p > atv_step_evidence.png
```

---

## 4. ACCEPTANCE CONCLUSION

* **Executed Tests:** 0 / 18 (Host missing physical Android TV device).
* **Passed Tests:** 0 / 18.
* **Blocked Tests:** 18 / 18 (`BLOCKED_EXTERNAL`).
* **Hardware Gate Status:** `BLOCKED_EXTERNAL`.
