# STREAMLAB v1.2.0 — PHASE 19.1 PREFLIGHT REPORT

**Authority:** Release Engineering / DevSecOps  
**Document ID:** PFR-PHASE19.1-PREFLIGHT-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Reported Tree SHA:** `7644340a3962d667c1d6fde0beb106afcab7e371`  
**Phase 19 Commit:** `f7aa1174ec4244465faa04f7d692c951b8777783`  
**Preflight Outcome:** `BUILD CONFIGURATION AUDITED — HUMAN APPROVAL REQUIRED`  

---

## 1. GIT IDENTITY & BASELINE INTEGRITY

The codebase was forensically verified prior to initiating build preparation:
* **Current Branch:** `feat/phase-18-product-advancement`
* **Baseline Freeze Commit:** `8181de0eec5d707f41394835dd15aa416305541b`
* **Baseline Tree SHA:** `7644340a3962d667c1d6fde0beb106afcab7e371`
* **Phase 19 Documentation Commit:** `f7aa1174ec4244465faa04f7d692c951b8777783`
* **Phase 19 Diff Inspection:** Confirmed 100% documentation-only changes (`docs/release/phase-19/`, 8 files changed, 664 insertions, 0 deletions).
* **Release Candidate Tag:** `v1.0.0-rc1` remains immutable (`ecb4c7cfd3f43498db7be2cebabcda2ff761f4c1` -> `b91e53effc681056498c05af7f4d10327360fc81`).
* **Working Tree State:** `nothing to commit, working tree clean`.

---

## 2. SOURCE-FREEZE VERIFICATION

* **Application Source Code Status:** Zero modifications made to `src/`, `mobile/src/`, `server/src/`, or database schemas.
* **Monorepo Automated Regression:** 78 tests passed, 0 failed, 0 skipped across 12 test suites.
* **Structural Parity:** 18/18 shared source files byte-for-byte identical between root `src/` and `mobile/src/`.

---

## 3. EAS PROJECT IDENTITY

* **Project Slug:** `streamlab` (configured in `mobile/app.json`).
* **EAS Project ID:** `NOT_LINKED` (`extra.eas.projectId` is not yet populated).
* **EAS CLI Version:** `27.2.0` (verified operational on Windows host via `npx --yes eas-cli`).
* **EAS Account Status:** `Not logged in` (`eas whoami` exited with code 1).

---

## 4. BUILD PROFILE SPECIFICATION

The audit of `mobile/eas.json` revealed four pre-configured profiles:

| Profile Name | Target Platform | Distribution Type | Build Type | Environment Flags | Recommended Use Case |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`preview-tv`** | Android | Internal | **`apk`** | `EXPO_TV: "1"` | **Android TV & Fire TV physical sideload testing** |
| **`preview-apk`** | Android | Internal | **`apk`** | None | Mobile Android APK sideload testing |
| **`development`** | Android / iOS | Internal | Dev Client | `developmentClient: true` | Local debugging |
| **`production`** | Android | Store | **`app-bundle`** | None | Google Play Store publication |

**Architectural Decision:** To satisfy the physical-device acceptance objectives of Android TV and Amazon Fire TV, the recommended build profile is **`preview-tv`**. It outputs a direct sideloadable `.apk` package and injects `EXPO_TV=1` to enable TV focus optimizations.

---

## 5. APPLICATION PACKAGE IDENTITY & SDK BOUNDS

* **Application Package ID:** `com.streamlab.app`
* **Version Name:** `1.2.0` (in `package.json`) / `0.2.0` (in `mobile/app.json`)
* **Version Code:** `1`
* **Minimum Android SDK:** API Level 28 (Android 9.0 Pie)
* **Target Android SDK:** API Level 34 (Android 14)
* **Permissions Requested:**
  - `android.permission.INTERNET`
  - `android.permission.ACCESS_NETWORK_STATE`
* **Launcher Categories:**
  - `android.intent.category.LAUNCHER`
  - `android.intent.category.LEANBACK_LAUNCHER`

---

## 6. SIGNING CREDENTIAL AVAILABILITY

* **Local Host Keystore:** Not present.
* **EAS Managed Keystore:** Awaiting authentication. When authenticated, EAS manages the Android Keystore securely on Expo cloud infrastructure using AES-256 encryption.
* **Security Protocol:** No private keys or passwords are stored in the git repository.

---

## 7. ESTIMATED BUILD IMPLICATIONS & USAGE

* **Build Environment:** Expo Application Services (EAS) Cloud Linux Builders.
* **Queue Priority:** Free tier accounts receive standard queue priority (estimated build duration: 8–15 minutes).
* **Concurrency:** 1 concurrent build.
* **Billing Impact:** Free tier allows up to 30 builds per month at no charge. Paid plans incur usage fees only beyond quota.
* **Precaution:** Explicit human authorization is required before triggering any cloud execution.

---

## 8. EXPECTED ARTIFACTS

Upon approved execution with profile `preview-tv`:
1. `streamlab-preview-tv.apk` (Android TV & Fire TV compatible Leanback APK).
2. Download URL hosted securely on `expo.dev`.
3. Build log archive detailing Gradle compilation and APK signing.

---

## 9. UNRESOLVED BLOCKERS PRIOR TO SUBMISSION

1. **EAS Authentication:** The host is not currently authenticated with Expo (`eas whoami` -> `Not logged in`).
   - *Resolution:* Requires an interactive login (`eas login`) or provision of an `EXPO_TOKEN` environment variable.
2. **EAS Project Association:** Project must be linked to the authenticated Expo account via `eas init` or project association prompt.
3. **Human Approval:** Per Section 6, cloud build execution is paused pending human sign-off.

---

## 10. PREFLIGHT RECOMMENDATION

The project build configuration (`app.json`, `eas.json`) is well-formed, complete, and TV-ready. Progression to build submission is **PAUSED** awaiting human confirmation and Expo authentication.
