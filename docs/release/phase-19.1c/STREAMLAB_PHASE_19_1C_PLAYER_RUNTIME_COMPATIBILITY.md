# STREAMLAB v1.2.0 — PLAYER RUNTIME COMPATIBILITY & MEDIA3 AUDIT

**Authority:** Principal Video Streaming Engineer / Playback Reliability Specialist  
**Document ID:** PRC-PHASE19.1C-MEDIA3-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Installed Library:** `react-native-video@6.19.3` (Locked in `package-lock.json`)  
**Underlying Engine:** **AndroidX Media3 (ExoPlayer) version 1.8.0**  

---

## 1. NATIVE PLAYER ENGINE EVIDENCE

An audit of the native Android Gradle dependencies of `react-native-video@6.19.3` established the underlying media architecture:

```groovy
// react-native-video/android/gradle.properties
RNVideo_media3Version=1.8.0
RNVideo_useExoplayerHls=true
RNVideo_useExoplayerDash=true
RNVideo_useExoplayerSmoothStreaming=true
RNVideo_androidxCoreVersion=1.13.1
RNVideo_androidxActivityVersion=1.9.3

// react-native-video/android/build.gradle
implementation "androidx.media3:media3-exoplayer:$media3_version"
implementation "androidx.media3:media3-exoplayer-hls:$media3_version"
implementation "androidx.media3:media3-datasource-okhttp:$media3_version"
implementation "androidx.media3:media3-ui:$media3_version"
implementation "androidx.media3:media3-session:$media3_version"
```

### Forensic Finding:
`react-native-video@6.19.3` embeds **Google AndroidX Media3 ExoPlayer 1.8.0** with native HLS, DASH, SmoothStreaming, and OkHttp data source extensions enabled out-of-the-box.

---

## 2. PLAYBACK CAPABILITY MATRIX: SUPPORTED VS TESTED

In adherence to strict streaming engineering standards:
> *"An HTTP 200 response or successful manifest download is not proof of playback. Distinguish supported formats from formats actually tested."*

| Playback Feature / Container | Native Engine Capability | Automated Test Status | Physical TV Hardware Status |
| :--- | :--- | :---: | :---: |
| **HLS (HTTP Live Streaming)** | Full support via `media3-exoplayer-hls` (TS & fMP4) | `UNIT_TESTED` (`live-player.test.js`) | `BLOCKED_EXTERNAL` |
| **MP4 Container (VOD)** | Progressive download via `media3-datasource` | `UNIT_TESTED` (`client.test.js` Test 4) | `BLOCKED_EXTERNAL` |
| **HTTP Range Requests** | Supported natively via `media3-datasource-okhttp` | `UNIT_TESTED` (Proxy contracts) | `BLOCKED_EXTERNAL` |
| **Adaptive Bitrate (ABR)**| Media3 DefaultBandwidthMeter / track selection | `UNVERIFIED_IN_AUTOMATION` | `BLOCKED_EXTERNAL` |
| **Hardware Video Decoders** | MediaCodec negotiation for H.264 (AVC) & H.265 (HEVC)| `UNVERIFIED_IN_AUTOMATION` | `BLOCKED_EXTERNAL` |
| **Audio Routing (AudioTrack)**| PCM 2.0 / 5.1 passthrough over HDMI eARC | `UNVERIFIED_IN_AUTOMATION` | `BLOCKED_EXTERNAL` |
| **Live TV Resume Bypass** | `isLive: true` forces start position 0 & suppresses seek| `TEST_VERIFIED` (`live-player.test.js` Test 1)| `BLOCKED_EXTERNAL` |
| **Indeterminate Duration** | Handles live streams with `duration = 0` / Infinity | `TEST_VERIFIED` (`live-player.test.js` Test 4)| `BLOCKED_EXTERNAL` |
| **Mini-Player Transition** | Picture-in-Guide mini-player isolation | `TEST_VERIFIED` (`live-player.test.js` Test 3)| `BLOCKED_EXTERNAL` |
| **Network Reconnection** | Exponential retry on socket drop | `UNVERIFIED_IN_AUTOMATION` | `BLOCKED_EXTERNAL` |
| **Extended 60m+ Playback** | Continuous decoding without frame drift / buffer leak | `UNVERIFIED_IN_AUTOMATION` | `BLOCKED_EXTERNAL` |

---

## 3. LIFECYCLE & BACKGROUND RECOVERY ANALYSIS

* **Home Button Backgrounding:** When the application transitions to `'background'`, `LivePlayer.js` invokes `player.current?.pause()` and unmounts the video surface. This invokes `ExoPlayer.stop()` and releases the hardware `MediaCodec` instance back to the Android OS.
* **Foreground Restoration:** When returning to `'active'`, `LivePlayer.js` re-instantiates the stream buffer, picking up the current live edge without attempting to resume obsolete buffered frames.

---

## 4. PLAYER AUDIT CONCLUSION

The underlying player engine (`AndroidX Media3 ExoPlayer 1.8.0`) is the gold standard for Android TV and Fire TV media playback. While software control contracts and UI bindings are **`UNIT_TESTED`**, physical hardware decoding, AudioTrack output, and continuous 60-minute playback remain **`BLOCKED_EXTERNAL`** pending physical device testing.
