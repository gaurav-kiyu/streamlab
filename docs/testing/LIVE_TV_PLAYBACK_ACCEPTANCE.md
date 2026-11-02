# StreamLab v1.1.0 — Live TV Playback Acceptance Report

**Subsystem:** Video Playback Engine & Mobile Player (`src/screens/Player.js`, `src/screens/LiveTV.js`)  
**Status:** Software Verified / Physical Hardware External Validation Required  
**Date:** 2026-11-01  

---

## 1. Playback Acceptance Criteria & Software Verification

StreamLab has established a verified **`isLive` Playback Contract** separating linear live streams from Video on Demand (VOD) state machinery.

| Verification Item | Acceptance Standard | Software / Mock Result | Physical Device Status |
| :--- | :--- | :---: | :---: |
| **Live-Edge Startup** | Player must start at live edge without seeking to historical timestamps. | **VERIFIED** (`resumeAt.current = 0`) | Pending physical HLS source |
| **No VOD Resume Seek** | Live streams must not apply stored playback positions from previous sessions. | **VERIFIED** (Tested in `live-player.test.js`) | Pending physical HLS source |
| **No VOD Completion** | Live streams must not trigger completion percentage (>90%) or marked watched. | **VERIFIED** (`onProgress` bypassed for `isLive`) | Pending physical HLS source |
| **No Continue Watching** | Live playback must not pollute the user's continue watching rail. | **VERIFIED** (`upsertRecent` blocked for `isLive`) | Pending physical HLS source |
| **Indeterminate Duration** | Live manifests reporting duration `0` or `null` must not produce `NaN` or timer bugs. | **VERIFIED** (`formatWatchDuration` returns `00:00`) | Pending physical HLS source |
| **Elapsed Watch Timer** | Player displays active viewing elapsed time indicator. | **VERIFIED** | Pending physical HLS source |
| **Channel Switching** | Rapidly switching channels in Picture-in-Guide cleanly replaces stream. | **VERIFIED** (`LiveTV.js` state machine) | Pending physical HLS source |
| **Audio Session Isolation** | Transitioning from mini-player to fullscreen preserves exactly 1 audio session. | **VERIFIED** (Tested in `live-player.test.js`) | Pending physical HLS source |

---

## 2. Experimental / Mock Playback Metrics

Under automated test harnesses and simulated media events:
- **Seek Offset on Live Init:** Exactly `0.00` seconds (no seek operations dispatched).
- **VOD Progress Event Count:** `0` progress packets dispatched to storage.
- **Timer Formatting Bounds:** Verified for `0s` (`00:00`), `75s` (`01:15`), and `3665s` (`1:01:05`).
- **Channel Switching Transitions:** Mini-player state cleanly unmounts previous stream before mounting next channel.

---

## 3. Physical Hardware & Network Testing Limitations

> [!IMPORTANT]
> In accordance with StreamLab Engineering Governance:
> Automated unit and mock tests cannot substitute for physical device frame decoding on physical silicon.
> Physical over-the-air playback certification across real cellular 4G/5G, degraded Wi-Fi, and real HDMI output devices is **BLOCKED** pending physical test lab provisioning. No unauthorized OTT commercial streams were used during testing.
