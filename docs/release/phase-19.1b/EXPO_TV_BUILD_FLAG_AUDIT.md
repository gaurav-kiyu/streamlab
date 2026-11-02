# STREAMLAB v1.2.0 — EXPO_TV BUILD FLAG AUDIT

**Authority:** DevSecOps Lead / Release Engineering  
**Document ID:** ETFA-PHASE19.1B-FLAG-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Classification:** `UNUSED BUILD VARIABLE IN CURRENT ENVIRONMENT`  

---

## 1. INVENTORY OF `EXPO_TV` OCCURRENCES

A comprehensive repository search confirmed the following declarations of `EXPO_TV`:
* **`mobile/eas.json`:** Profile `preview-tv` injects `"env": { "EXPO_TV": "1" }`.
* **`eas.json` (root):** Profile `preview-tv` injects `"env": { "EXPO_TV": "1" }`.
* **`mobile/package.json`:** Script `"android-tv": "EXPO_TV=1 expo run:android"`.
* **`mobile/package.json`:** Script `"apple-tv": "EXPO_TV=1 expo run:ios"`.
* **Documentation:** Mentioned in `README.md`, `STREAMLAB_BUILD_ARTIFACT_REGISTER.md`, and deployment runbooks.

---

## 2. FUNCTIONAL CONSUMER VERIFICATION

Each stage of the compilation pipeline was forensically audited to determine whether `EXPO_TV` alters execution:

| Compilation Layer | Audited Component | Is `EXPO_TV` Consumed? | Forensic Verification Evidence |
| :--- | :--- | :---: | :--- |
| **JavaScript / TypeScript Source** | Application screens & components | **NO** | `git grep "EXPO_TV"` returns 0 lines in `.js` source files. |
| **Metro Bundler** | `metro.config.js` | **NO** | Default Metro configuration; no custom extension resolver for `.tv.js`. |
| **Babel Compiler** | `babel.config.js` | **NO** | Standard `babel-preset-expo`; no conditional TV transform plugins. |
| **Expo Config Plugins** | `mobile/app.json` `plugins` | **NO** | Only `expo-secure-store` plugin declared; `@react-native-tvos/config-tv` absent. |
| **Gradle Android Build** | `build.gradle` / `settings.gradle` | **NO** | Standard Expo Android Gradle scripts do not evaluate `System.getenv("EXPO_TV")`. |
| **Native Dependency Rewiring** | `package.json` resolver | **NO** | No npm alias or pnpm hook rewires `react-native` to `react-native-tvos`. |

---

## 3. HISTORICAL CONTEXT & ECOSYSTEM EVOLUTION

### 3.1 Historical Role of `EXPO_TV=1`
In early experimental Expo TV prototypes (circa Expo SDK 43–46), Expo's internal prebuild CLI contained a hardcoded check for `process.env.EXPO_TV === '1'` to conditionally swap template manifests and Gradle configurations.

### 3.2 Current State in Expo SDK 52
In Expo SDK 50 through 52, Expo completely deprecated the internal `EXPO_TV` environment flag in favor of the declarative Config Plugin architecture:
* The modern, official Expo TV pathway is `@react-native-tvos/config-tv`.
* In modern Expo CLI, setting `EXPO_TV=1` in an environment without `@react-native-tvos/config-tv` does not trigger any native code modification or dependency swapping.

---

## 4. WHAT ACTUALLY ENABLES STREAMLAB'S TV LAUNCH & NAVIGATION?

Because `EXPO_TV=1` is functionally an unused environment variable, StreamLab's TV capability is enabled entirely through declarative manifest and source configuration:

1. **Leanback Launcher Intent Filter:**
   ```json
   "intentFilters": [
     {
       "action": "MAIN",
       "category": [
         "LAUNCHER",
         "LEANBACK_LAUNCHER"
       ]
     }
   ]
   ```
   *Impact:* Directs the Android OS to register the application on the Android TV and Amazon Fire TV Leanback app row.
2. **Native Focus Traversal:**
   *Impact:* View components declaring `focusable={true}` register with Android's native `FocusFinder` window engine.
3. **Hardware UI Mode Detection:**
   *Impact:* Standard React Native core detects the television device mode at runtime via `UiModeManager`, setting `Platform.isTV === true`.

---

## 5. AUDIT CONCLUSION

`EXPO_TV=1` is classified as an **unused legacy build variable**. Its presence in `mobile/eas.json` is completely harmless, but it does **not** dynamically modify the native build output. TV capabilities are driven by `mobile/app.json` intent filters and component-level focus code.
