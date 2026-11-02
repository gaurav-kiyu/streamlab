# StreamLab — Live TV Player Implementation

**Version:** 1.1.0  
**Status:** Approved & Implemented  
**Subsystem:** Video Playback & Player UX

---

## 1. Architectural Purpose & Problem Statement

Video on Demand (VOD) playback engines maintain internal state machinery that conflicts directly with linear live streams:
- VOD engines attempt to restore stale playback positions via `seek(resumePosition)` upon startup. In a live stream, seeking to an arbitrary historical second causes infinite buffering or crashes HLS playlist manifests.
- VOD engines calculate completion percentages (`currentTime / duration >= 0.90`) and trigger "Watched" flags or sync playback positions to cloud servers. Live streams have infinite or indeterminate durations.
- VOD scrubbers allow dragging across an arbitrary duration slider, which is meaningless for a live broadcast edge.

StreamLab resolves these architectural conflicts with a dedicated **`isLive` Playback Contract** implemented in `src/screens/Player.js`.

---

## 2. The `isLive` Playback Contract

When `item?.isLive` is set to `true`:

### A. Position Restoration & Seek Bypass
```javascript
// Player.js
useEffect(() => {
  if (item?.isLive) {
    // Live streams must always tune directly to the broadcast live edge.
    resumeAt.current = 0;
    initialSeekDone.current = true;
    return;
  }
  // Standard VOD resume logic ...
}, [url, item]);
```
- The initial seek operation is marked as completed immediately with offset `0`.
- The player connects directly to the latest live HLS/DASH media segment without attempting to seek into past buffer windows.

### B. Progress Sync & Completion Elimination
```javascript
// Player.js
const onProgress = useCallback((data) => {
  setCurrentTime(data.currentTime);
  if (item?.isLive) {
    // Live streams do not record VOD resume positions or cloud sync
    return;
  }
  // VOD progress saving & cloud sync ...
}, [url, item]);
```
- Periodic saves to `AsyncStorage` and cloud synchronizations (`syncCloudProgress`) are completely bypassed.
- No completion percentage is evaluated, preventing live television streams from falsely polluting the user's "Continue Watching" VOD rail.

### C. Live Edge UI Controls
- The standard VOD seek bar is replaced with a prominent **`🔴 LIVE STREAM`** status badge.
- A live elapsed watch timer displays the active continuous viewing duration.
- Relative seek buttons (e.g. ±10s) are hidden to maintain focus on the live broadcast.
- The top header presents the channel name, current programme title (when available from EPG), and stream quality indicators.

---

## 3. Picture-in-Guide / Mini-Player Mode

To deliver a premium browsing experience, StreamLab introduces a docked Picture-in-Guide mini-player directly inside `LiveTV.js`:
- Long-pressing or tapping the preview icon on any channel launches the stream in a compact 16:9 docked container.
- Audio can be quickly muted/unmuted with a single tap.
- A single click on **`⛶ Fullscreen`** smoothly transitions the playback session into the full `Player` interface without reloading or re-resolving stream metadata.
- If a preview stream encounters an error or network timeout, a non-blocking error badge is shown without crashing the EPG browser.
