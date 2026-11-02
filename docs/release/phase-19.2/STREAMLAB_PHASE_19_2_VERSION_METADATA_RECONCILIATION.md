# STREAMLAB v1.2.0 — PHASE 19.2 VERSION METADATA RECONCILIATION

**Authority:** Principal Software Architect / Release Engineering Lead  
**Document ID:** VMR-PHASE19.2-VERSIONS-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Reconciliation Status:** `COMPLETE & CERTIFIED`  

---

## 1. PRE-CHANGE VS POST-CHANGE METADATA MATRIX

| Configuration File | Inspected Property | Before Value | After Value | Milestone Alignment Status |
| :--- | :--- | :---: | :---: | :---: |
| **`package.json` (Root)** | `"version"` | `1.2.0` | `1.2.0` | **MATCH (Canonical)** |
| **`mobile/package.json`** | `"version"` | `1.2.0` | `1.2.0` | **MATCH (Canonical)** |
| **`server/package.json`** | `"version"` | `1.2.0` | `1.2.0` | **MATCH (Canonical)** |
| **`mobile/app.json`** | `"expo.version"` | `0.2.0` | **`1.2.0`** | **RECONCILED** |
| **`mobile/app.json`** | `"expo.android.versionCode"`| `1` | **`10200`** | **RECONCILED** |
| **`app.json` (Root Mirror)** | `"expo.version"` | `0.2.0` | **`1.2.0`** | **RECONCILED** |
| **`app.json` (Root Mirror)** | `"expo.android.versionCode"`| `1` | **`10200`** | **RECONCILED** |
| **`mobile/app.json`** | `"expo.ios.buildNumber"` | `"1"` | `"1"` | **UNCHANGED (iOS Out of Scope)** |

---

## 2. HISTORICAL ANDROID VERSION-CODE FORENSIC VERIFICATION

Prior to applying `versionCode: 10200`, a complete historical Git audit (`git log -S "versionCode" -p`) was conducted to ensure no previously generated or distributed Android artifact had ever used an equal or higher version code:

### Git Forensic Findings:
1. **Initial Introduction:** `versionCode: 1` was introduced in commit `7e9be3ab3b8dad4858283c8c058587ce34cc6ce8` (Phase 14 release preparation).
2. **Commit History:** From commit `7e9be3ab` through the `v1.0.0-rc1` freeze (`b91e53e`) and subsequent phases (16, 17, 17.1, 18, 19, 19.1), `versionCode` has remained permanently at `1`.
3. **Artifact Register:** `STREAMLAB_BUILD_ARTIFACT_REGISTER.md` records zero local native APK distributions.
4. **Monotonicity Verification:** $10200 > 1$. The upgrade from `1` to `10200` is strictly monotonic and satisfies Android `PackageManagerService` update enforcement (`PackageSetting.versionCode` check).

---

## 3. SEMANTIC SPACING OF `versionCode: 10200`

The canonical version code `10200` was constructed using the industry-standard integer formula:
$$\text{versionCode} = (\text{MAJOR} \times 10000) + (\text{MINOR} \times 100) + \text{PATCH}$$
* For StreamLab v1.2.0: $(1 \times 10000) + (2 \times 100) + 0 = 10200$.
* This allocation allows up to 99 consecutive patch revisions (`10201` for `v1.2.1` through `10299` for `v1.2.99`) before requiring a minor version increment (`10300` for `v1.3.0`).

---

## 4. RUNTIME METADATA CONSISTENCY VERIFICATION

Executing `node -e` validation against the updated manifest confirmed:
```
app.json JSON valid. version: 1.2.0 versionCode: 10200
rootApp version: 1.2.0 versionCode: 10200
```
When compiled into an APK, Android's `aapt dump badging` and Android TV OS Settings will now consistently report:
* `versionName='1.2.0'`
* `versionCode='10200'`
* `package='com.streamlab.app'`
