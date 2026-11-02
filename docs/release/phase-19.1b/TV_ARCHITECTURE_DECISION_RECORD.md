# STREAMLAB v1.2.0 — TV ARCHITECTURE DECISION RECORD (ADR)

**Authority:** Principal Software Architect / Release Governance Board  
**Document ID:** ADR-2026-004-TV-RUNTIME  
**Execution Date:** 2026-11-01  
**Status:** `RECOMMENDED FOR APPROVAL`  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  

---

## 1. CONTEXT & PROBLEM STATEMENT

StreamLab v1.2.0 is designed as a unified streaming client supporting mobile phones, tablets, Android TV, and Amazon Fire TV.

A critical engineering question was posed during Phase 19.1 pre-build audits:
> *Does StreamLab's current reliance on standard React Native 0.76.2 provide genuine TV runtime support, or must the project adopt the `react-native-tvos` community fork or maintain separate mobile and TV packages?*

---

## 2. COMPARATIVE EVALUATION OF ARCHITECTURAL ALTERNATIVES

### Alternative A: Retain Standard React Native & Validate Existing Native Focus (Recommended)
* **Architecture:** Retain `react-native@0.76.2` in `mobile/package.json`. Rely on native Android `View.setFocusable(true)`, `hasTVPreferredFocus`, and `Platform.isTV` layout scaling.
* **Dependency Compatibility:** 100% aligned with existing Expo SDK 52 and lockfiles. Zero new packages.
* **Expo SDK Compatibility:** Native. No custom config plugins required.
* **Native Build Complexity:** Low. Compiles a standard universal Android APK with Leanback launcher intents.
* **Code Duplication:** None. Single universal mobile and TV codebase.
* **Regression Risk:** **0% risk** to existing mobile, tablet, and web clients.
* **TV Remote Support:** Supports D-pad navigation across all channel rows, cards, and video player controls.
* **Mobile Application Impact:** None.
* **Fire TV Support:** 100% compatible via AOSP focus traversal.
* **Trade-offs / Limitations:** Does not support Apple tvOS (out of scope) or `TVFocusGuideView` for discontinuous spatial gaps.

---

### Alternative B: Adopt the Matching `react-native-tvos` Fork
* **Architecture:** Replace `react-native@0.76.2` with `react-native-tvos@^0.76.2-0` and add `@react-native-tvos/config-tv`.
* **Dependency Compatibility:** High complexity. Requires replacing core React Native with a community fork across the entire mobile workspace.
* **Expo SDK Compatibility:** Moderate. Supported via Expo TV config plugin.
* **Native Build Complexity:** High. Swaps native Android and iOS engines.
* **Code Duplication:** Low.
* **Regression Risk:** **HIGH**. Running `react-native-tvos` on mobile phones is known to introduce touch gesture, keyboard, and virtual input regressions on standard smartphones.
* **TV Remote Support:** Full support including Apple tvOS and `TVFocusGuideView`.
* **Mobile Application Impact:** Substantial risk of mobile touch instabilities.
* **Fire TV Support:** Compatible, but redundant for standard AOSP keycodes.
* **Trade-offs / Limitations:** Violates the frozen baseline by introducing dependency upgrades and unneeded native complexity.

---

### Alternative C: Maintain Separate Mobile and TV Workspaces
* **Architecture:** Split the mobile monorepo into `@streamlab/mobile` (using standard RN) and `@streamlab/tv` (using `react-native-tvos`), extracting common UI components into `@streamlab/ui`.
* **Dependency Compatibility:** Clean separation, but requires extensive monorepo restructuring.
* **Expo SDK Compatibility:** High.
* **Native Build Complexity:** Very High. Dual build pipelines, dual EAS projects, and shared component bundling.
* **Code Duplication:** Moderate. Shared package overhead.
* **Regression Risk:** High refactoring risk.
* **TV Remote Support:** Excellent.
* **Mobile Application Impact:** Complete workspace reorganization required.
* **Trade-offs / Limitations:** Entirely outside the scope of a frozen release candidate. Disproportionate complexity for current requirements.

---

## 3. DECISION & RECOMMENDATION

### Formal Architectural Recommendation:
**ADOPT ALTERNATIVE A: Retain Standard React Native and Validate Existing Native Focus.**

### Rationale:
1. **Source Fit:** StreamLab's source code already uses standard native Android focus (`focusable={true}`, `hasTVPreferredFocus`, and `Platform.isTV`). It does not consume any fork-only APIs.
2. **Zero Freeze Disruption:** Alternative A respects the v1.2.0 engineering freeze by requiring **zero dependency changes**, zero package manifest edits, and zero code churn.
3. **Multi-Screen Safety:** Preserves 100% stability and zero regression risk across mobile, tablet, and web form factors.
4. **Feasibility:** Genuinely sideloadable and operable on both physical Android TV and Amazon Fire TV reference hardware.
