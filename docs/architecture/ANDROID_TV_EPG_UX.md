# StreamLab — Android TV / 10-Foot EPG Guide Experience

**Version:** 1.1.0  
**Status:** Approved & Implemented  
**Subsystem:** Android TV / Fire TV / Apple TV 10-Foot UI

---

## 1. 10-Foot UI Design Principles

Navigating a television interface with a directional pad (D-pad) remote control across a 3-meter viewing distance demands distinct ergonomics from mobile touch interfaces:
1. **Unambiguous Spatial Focus:** At all times, exactly one interactive element on the screen must possess visual focus with clear contrast (`#ff6b8b` glowing border).
2. **Predictable D-Pad Traversal:** Pressing **Down** always advances to the next channel; pressing **Right** always advances to the next chronological programme on the focused channel.
3. **High Information Density with Legibility:** Large, readable typography for titles (`13-15pt`), distinct category coloring, and elapsed progress indicators.
4. **Resilient Degradation:** Missing EPG data must display informative placeholders without breaking grid alignment or navigation focus.

---

## 2. 10-Foot EPG Grid Architecture

The 10-foot EPG guide (`LiveTV.js` in `grid` view mode) structures metadata into a coordinated spatial grid:

```
┌───────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│  CHANNEL      │  NOW (12:30 PM)      │  NEXT (01:00 PM)     │  UPCOMING (01:30 PM) │
├───────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ [101] DD News │ Prime Time Debate    │ Special Report       │ Regional News Wrap   │
│               │ [====== 65% =======] │                      │                      │
├───────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ [102] Sports  │ Live Cricket Match   │ Post-Match Analysis  │ Sports Digest        │
│               │ [== 20% ===========] │                      │                      │
└───────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
```

### Component Layout
- **Sticky Time Slot Header:** Displays the current viewing block partitioned into 30-minute intervals (`HH:MM AM/PM`).
- **Channel Column (Left):** Displays the channel logo, number badge, and channel title. Focusable to immediately initiate live streaming.
- **Programme Blocks (Right):** Horizontal cards sized proportionally by time window.
  - Active programme cards display the show title, air time range, an elapsed progress bar, and description synopsis.
  - Selecting a programme block triggers instant full-screen playback or preview.

---

## 3. Remote Control D-Pad Focus Engine

All interactive components in the TV EPG grid leverage React Native TV focus primitives:
- `focusable={true}`: Informs the native Android TV / Fire TV accessibility and focus engine that the view can receive remote focus.
- `onFocus={() => setFocusedChannelId(item.id)}`: Coordinates row-level focus highlighting when descending or ascending through channels.
- Active focus state styles:
  ```javascript
  gridRowFocused: {
    borderColor: "#ff6b8b",
    backgroundColor: "#1c3547"
  }
  ```

---

## 4. Graceful Fallback Handling

When a broadcaster does not provide an XMLTV feed or when the feed is temporarily unavailable:
- The channel row renders a standard fallback card: **"Program Information Unavailable"**.
- The channel remains 100% playable with a single click. Missing metadata never impairs video streaming.
