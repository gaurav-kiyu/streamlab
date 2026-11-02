# STREAMLAB v1.2.0 — EAS PROJECT IDENTITY AUDIT

**Authority:** Principal Software Architect / DevSecOps Engineer  
**Document ID:** PIA-PHASE19.1A-EAS-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Reported Tree SHA:** `7644340a3962d667c1d6fde0beb106afcab7e371`  
**Audit Outcome:** `UNLINKED — CONFIGURATION RECONCILIATION REQUIRED`  

---

## 1. EXPO CONFIGURATION & IDENTITY AUDIT

An inspection of `mobile/app.json` was conducted to determine current Expo Application Services (EAS) project linkage:

```json
{
  "expo": {
    "name": "StreamLab",
    "slug": "streamlab",
    "version": "0.2.0",
    "orientation": "default",
    ...
```

### Forensic Findings:
1. **Missing `extra.eas.projectId`:** The root configuration lacks an `extra.eas.projectId` UUID.
2. **Missing `owner` declaration:** No Expo account/organization namespace (`owner: "<account>"`) is declared.
3. **EAS CLI Authentication:** Running `npx eas-cli whoami` confirms `Not logged in` (Exit code 1).
4. **Linkage Status:** The local project is **completely unlinked** from any remote EAS cloud project entity.

---

## 2. WORKFLOW REQUIREMENTS & PROJECT ID NECESSITY

### 2.1 Is a Project ID required for EAS Cloud Build?
**Yes.** EAS Cloud Builders require a unique project UUID to:
* Provision a dedicated build pipeline and secure container.
* Associate Android signing keystores and credentials.
* Track build artifacts, logs, and distribution channels on `expo.dev`.
* Enforce account quotas and concurrency limits.

### 2.2 What happens if `eas build` is executed unlinked?
If `eas build` is invoked interactively without a pre-existing project ID:
1. EAS prompts the user to log in.
2. EAS asks: *"Would you like to automatically configure your project with EAS?"*
3. Upon confirmation, EAS generates a new project on Expo servers and **automatically writes** `extra.eas.projectId` into `mobile/app.json`.

---

## 3. FREEZE COMPLIANCE & RECONCILIATION PATHWAYS

Under the StreamLab v1.2.0 Engineering Freeze, modifying tracked application files is prohibited without explicit authorization.

Two execution pathways exist:

### Pathway A: Authorized Configuration Amendment (Standard & Recommended)
* **Action:** Formally authorize amending `mobile/app.json` to link the EAS project and align versioning under a dedicated documentation & configuration reconciliation commit.
* **Exact File Modified:** `mobile/app.json` only.
* **Expected Injected Block:**
  ```json
  "extra": {
    "eas": {
      "projectId": "<generated-project-uuid>"
    }
  }
  ```
* **Pros:** Standard EAS workflow; reproducible builds for any team member with access to the Expo organization.
* **Cons:** Requires explicit governance sign-off to touch `mobile/app.json`.

### Pathway B: Zero-File-Change Environment Variable Injection (Ephemeral)
* **Action:** Create the project directly on `expo.dev` via the web console or CLI outside the repo, then inject the project ID at runtime via the environment variable:
  ```bash
  $env:EAS_PROJECT_ID="<generated-project-uuid>"
  npx eas-cli build --platform android --profile preview-tv
  ```
* **Exact Files Modified:** `0` (Zero repository files modified).
* **Pros:** Strictly preserves the byte-for-byte SHA of `mobile/app.json`.
* **Cons:** Fragile; requires manual environment variable orchestration across different build machines and CI runners.

---

## 4. CONCLUSION

EAS project linkage is currently unlinked. To proceed with cloud compilation, the Release Governance Board must authorize either Pathway A (formal `app.json` project ID insertion) or Pathway B (ephemeral `EAS_PROJECT_ID` environment injection).
