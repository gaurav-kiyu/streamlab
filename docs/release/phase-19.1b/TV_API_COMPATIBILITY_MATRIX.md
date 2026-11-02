# STREAMLAB v1.2.0 — TV API COMPATIBILITY MATRIX

**Authority:** Senior React Native Engineer / QA Automation Lead  
**Document ID:** TACM-PHASE19.1B-APIS-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Scope:** Exhaustive Component & Source File Audit  

---

## 1. COMPONENT-BY-COMPONENT TV API INVENTORY

| API Name | Source File | Component / Line | Current Implementation | Native Runtime Mechanism | Core RN 0.76.2? | TV Fork Required? | Test Evidence |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **`Platform.isTV`** | `mobile/src/screens/Browse.js` | Line 23 | `const isTV = Platform.isTV;` (Adjusts card width `W = isTV ? 220 : 130`) | Android `UiModeManager.getCurrentModeType() == 4` | **YES** | **NO** | Component renders cards at 220dp width. |
| **`Platform.isTV`** | `mobile/src/screens/Details.js` | Line 19 | Scaled backdrop height (`380` vs `220`), title size (`34` vs `24`) | Android `UiModeManager` | **YES** | **NO** | Details layout passes responsive snapshot checks. |
| **`Platform.isTV`** | `mobile/src/screens/LiveTV.js` | Line 33 | `const [viewMode] = useState(isTV ? "grid" : "list");` | Android `UiModeManager` | **YES** | **NO** | Default view mode initializes to 2D EPG grid. |
| **`Platform.isTV`** | `mobile/src/screens/Player.js` | Line 18 | Scaled OSD play/pause controls (`96dp` vs `74dp`) | Android `UiModeManager` | **YES** | **NO** | `live-player.test.js` (Test 1, 3, 4 pass). |
| **`Platform.isTV`** | `mobile/src/screens/Search.js` | Line 17 | `autoFocus={!isTV}` (Suppresses auto virtual keyboard on TV) | Android `UiModeManager` | **YES** | **NO** | `client.test.js` (Test 8 passes). |
| **`Platform.isTV`** | `mobile/src/screens/Settings.js`| Line 18 | TV container padding & layout wrap | Android `UiModeManager` | **YES** | **NO** | Settings layout checks pass. |
| **`Platform.isTV`** | `mobile/src/screens/Welcome.js` | Line 6 | Typography scaling (`38` vs `28`) & safe padding | Android `UiModeManager` | **YES** | **NO** | Welcome view checks pass. |
| **`focusable={true}`** | `mobile/src/screens/LiveTV.js` | Line 571 | Channel card wrap in guide row | Android native `View.setFocusable(true)` | **YES** | **NO** | Focus border highlights in high-contrast cyan. |
| **`focusable={true}`** | `mobile/src/screens/LiveTV.js` | Line 591 | Mini-guide toggle button | Android native `View.setFocusable(true)` | **YES** | **NO** | Button accepts D-pad focus. |
| **`focusable={true}`** | `mobile/src/screens/LiveTV.js` | Line 622 | Channel switching action strip | Android native `View.setFocusable(true)` | **YES** | **NO** | Fast channel switching logic verified. |
| **`hasTVPreferredFocus`**| `mobile/src/screens/Browse.js` | Line 50 | Category filter pill autofocus | Core React Native View prop | **YES** | **NO** | First filter pill receives default focus. |
| **`hasTVPreferredFocus`**| `mobile/src/screens/Details.js`| Line 25 | Primary "Play" button autofocus | Core React Native View prop | **YES** | **NO** | Focus anchors to Play action. |
| **`hasTVPreferredFocus`**| `mobile/src/screens/Player.js` | Line 238| Player play/pause center button | Core React Native View prop | **YES** | **NO** | Remote center key immediately triggers pause. |
| **`hasTVPreferredFocus`**| `mobile/src/screens/Welcome.js`| Line 12 | Initial "Get Started" CTA button | Core React Native View prop | **YES** | **NO** | Focus lands on primary CTA on first launch. |
| **`TVEventHandler`** | *None* | 0 files | Not consumed in codebase | Native TV key listener | N/A | **YES** | No usage found in codebase. |
| **`useTVEventHandler`** | *None* | 0 files | Not consumed in codebase | React hook for TV events | N/A | **YES** | No usage found in codebase. |
| **`TVFocusGuideView`** | *None* | 0 files | Not consumed in codebase | Native spatial focus guide | N/A | **YES** | No usage found in codebase. |
| **`nextFocusUp/Down/etc`**| *None* | 0 files | Not consumed in codebase | Directional focus target IDs | N/A | **YES** | No usage found in codebase. |

---

## 2. ORDINARY ANDROID FOCUS VS REACT NATIVE TV-SPECIFIC FORK APIS

### Category 1: Ordinary Android Native Focus (Supported in Core React Native)
* In standard Android development, any `View` can receive D-pad focus if `setFocusable(true)` is enabled.
* In React Native core, setting `focusable={true}` bridges directly to `view.setFocusable(true)` on Android.
* D-pad key events (`DPAD_UP`, `DPAD_DOWN`, `DPAD_LEFT`, `DPAD_RIGHT`, `DPAD_CENTER`) are handled by Android's native focus search engine (`FocusFinder`), which computes spatial proximity and moves focus automatically without requiring JavaScript code.
* Back button key events (`KEYCODE_BACK`) are dispatched to Android's `onBackPressed()` and handled by React Native's standard `BackHandler` API.
* **StreamLab Status:** StreamLab's entire TV navigation architecture is constructed upon this ordinary native Android focus foundation.

### Category 2: React Native TV-Specific Fork APIs (Requires `react-native-tvos`)
* `TVFocusGuideView`: Used to bridge discontinuous spatial layout gaps on Apple tvOS or complex nested grids where Android's native `FocusFinder` gets trapped.
* `TVEventHandler` / `useTVEventHandler`: JavaScript event listeners for raw remote button press events (e.g. Menu, Play/Pause, Rewind, Fast Forward).
* **StreamLab Status:** StreamLab does not use discontinuous spatial focus gaps or raw JavaScript TV event listeners. Media controls use on-screen focusable buttons with D-pad center activation.

---

## 3. COMPATIBILITY MATRIX SUMMARY

* **Total TV APIs Consumed:** 3 (`Platform.isTV`, `focusable`, `hasTVPreferredFocus`).
* **APIs Requiring `react-native-tvos` Fork:** **0**.
* **Compatibility Status with Core React Native 0.76.2:** **100% Compatible**.
