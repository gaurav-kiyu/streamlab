# StreamLab v1.1.0 — Android TV & 10-Foot UI Acceptance Report

**Subsystem:** Android TV / Fire TV / Apple TV 10-Foot Experience  
**Interface:** `mobile/src/screens/LiveTV.js` (Grid View Mode)  
**Status:** Software Verified / Physical Hardware Testing BLOCKED  
**Date:** 2026-11-01  

---

## 1. 10-Foot UI Spatial Navigation Architecture

The television EPG guide is designed for directional pad (D-pad) remote controls across a 3-meter viewing distance:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 10-FOOT EPG TIMELINE GRID                                                   │
├──────────────┬────────────────────────┬─────────────────────────────────────┤
│ Remote Key   │ Spatial Action         │ Focus State Behavior                │
├──────────────┼────────────────────────┼─────────────────────────────────────┤
│ D-Pad Up     │ Channel N-1            │ Moves row focus upward              │
│ D-Pad Down   │ Channel N+1            │ Moves row focus downward            │
│ D-Pad Right  │ Next Programme Slot    │ Traverses chronological show cards  │
│ D-Pad Left   │ Previous Programme     │ Traverses earlier show cards        │
│ Center/Enter │ Tune Channel / Play    │ Opens Fullscreen or Mini-Player     │
│ Back Button  │ Exit Guide / Dismiss   │ Restores previous screen navigation │
└──────────────┴────────────────────────┴─────────────────────────────────────┘
```

### Focus Primitives & Visual Highlighting
- Components declare `focusable={true}` to register with Android TV and Fire TV native focus engines.
- Focused rows adopt `#ff6b8b` glowing border styling (`gridRowFocused: { borderColor: "#ff6b8b", backgroundColor: "#1c3547" }`).
- Television detection leverages `Platform.isTV`, automatically defaulting initial view mode to `"grid"`.

---

## 2. Display Resolution & Overscan Verification

- **Overscan Margins:** 16dp horizontal and vertical padding ensures content is never clipped by CRT or legacy LCD television overscan boundaries.
- **Typography Scale:** Channel and show titles use large bold text (`13-15pt` on TV, scalable up to `28pt` on 4K displays).
- **Time Window Header:** Fixed 30-minute intervals display sticky headers across the 4-hour viewing horizon.

---

## 3. Physical Hardware Governance Declaration

> [!WARNING]
> **GOVERNANCE STATUS: BLOCKED ON PHYSICAL HARDWARE**
> 
> While software components, layout geometry, focus props (`focusable={true}`), and mocked D-pad key events are fully implemented and unit-verified in the codebase, **physical verification on real Android TV / Fire TV hardware is explicitly declared BLOCKED**.
> 
> In accordance with StreamLab Engineering Governance:
> A unit test or web/mobile emulator will NEVER be falsely certified as physical device acceptance. Physical acceptance requires testing on certified Google TV / Amazon Fire TV devices with physical remote controls.
