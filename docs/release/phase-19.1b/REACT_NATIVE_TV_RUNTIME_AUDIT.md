# STREAMLAB v1.2.0 — REACT NATIVE TV RUNTIME AUDIT

**Authority:** Principal Software Architect / React Native TV Specialist  
**Document ID:** RNTA-PHASE19.1B-RUNTIME-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Reported Tree SHA:** `7644340a3962d667c1d6fde0beb106afcab7e371`  
**Audit Outcome:** `STANDARD REACT NATIVE RUNTIME IS SUITABLE FOR ANDROID/FIRE TV`  

---

## 1. OFFICIAL REACT NATIVE TV ARCHITECTURAL LANDSCAPE

In the broader React Native ecosystem, television support is bifurcated into two distinct architectures:

### 1.1 The Community `react-native-tvos` Fork
* **History:** In React Native 0.62+, Meta extracted Apple tvOS and specialized Android TV focus guides out of core React Native into the community-maintained `react-native-tvos` fork.
* **Release Alignment:** `react-native-tvos` releases track upstream Meta releases (e.g. `react-native-tvos@0.76.x-0` corresponds to `react-native@0.76.x`).
* **Purpose:** Primarily essential for **Apple tvOS** (which Meta core completely lacks) and advanced spatial navigation features (`TVEventHandler`, `TVFocusGuideView`).
* **Expo Integration:** Expo SDK 52 supports this fork via `@react-native-tvos/config-tv`. However, using it replaces the core `react-native` package and increases regression risks for standard mobile phone touch interactions.

### 1.2 Core React Native on Android TV / Fire OS (AOSP)
* **Architecture:** Android TV and Fire OS are native forks of the Android Open Source Project (AOSP). Standard React Native Android runs on the native Android ART/JVM runtime.
* **Native Focus System:** In core React Native, the `View` component supports `focusable={true}`. On Android, this sets `view.setFocusable(true)` on the underlying native `ReactViewGroup`.
* **Hardware Input Events:** The native Android Window dispatches D-pad key events (`KEYCODE_DPAD_UP`, `DOWN`, `LEFT`, `RIGHT`, `CENTER`, `BACK`) to the focused `View`.
* **Platform Detection:** In core React Native on Android (`Platform.android.js`), `Platform.isTV` queries Android's `UiModeManager.getCurrentModeType()`. On Android TV and Amazon Fire TV, it returns `Configuration.UI_MODE_TYPE_TELEVISION`, causing `Platform.isTV` to evaluate to `true` automatically!

---

## 2. STREAMLAB CODEBASE TV USAGE AUDIT

A complete scan of all source files in `mobile/src/` and `src/` was conducted to determine which TV APIs are actually consumed:

| TV API / Mechanism | Present in StreamLab Source? | File Locations | Supported in Core RN 0.76.2? | Requires `react-native-tvos`? |
| :--- | :---: | :--- | :---: | :---: |
| **`Platform.isTV`** | **YES** | `Browse.js`, `Details.js`, `LiveTV.js`, `Player.js`, `Search.js`, `Settings.js`, `Welcome.js` | **YES** (Via Android `UiModeManager`) | **NO** |
| **`focusable={true}`** | **YES** | `LiveTV.js` (Lines 571, 591, 622) | **YES** (Sets native `focusable="true"`) | **NO** |
| **`hasTVPreferredFocus`** | **YES** | `Browse.js` (L50), `Details.js` (L25), `Player.js` (L238), `Welcome.js` (L12) | **YES** (Accepted by React Native View) | **NO** |
| **`TVEventHandler`** | **NO** | None (0 occurrences across repository) | N/A | **YES** |
| **`useTVEventHandler`** | **NO** | None (0 occurrences across repository) | N/A | **YES** |
| **`TVFocusGuideView`** | **NO** | None (0 occurrences across repository) | N/A | **YES** |
| **`nextFocus*` overrides** | **NO** | None (0 occurrences across repository) | N/A | **YES** |

---

## 3. AUDIT CONCLUSION

1. **Zero Fork-Only API Consumption:** StreamLab does not consume any proprietary APIs exclusive to the `react-native-tvos` fork.
2. **Core RN Sufficiency:** The existing standard `react-native@0.76.2` dependency is completely sufficient to execute StreamLab's TV UI, responsive 10-foot scaling, and Android D-pad navigation.
3. **No Dependency Churn:** Adopting `react-native-tvos` would introduce unnecessary dependency churn, invalidate the frozen baseline, and risk mobile regressions without providing additional functionality needed by StreamLab's current UI.
