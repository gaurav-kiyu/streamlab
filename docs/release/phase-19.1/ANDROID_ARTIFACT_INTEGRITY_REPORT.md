# STREAMLAB v1.2.0 — ANDROID ARTIFACT INTEGRITY REPORT

**Authority:** DevSecOps Lead / QA Certification Lead  
**Document ID:** AIR-PHASE19.1-ARTIFACTS-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Artifact Verification Status:** `PENDING_APPROVAL`  

---

## 1. ARTIFACT INVENTORY AUDIT

Because cloud compilation is pending human approval, no new native binaries have been generated on the host or downloaded from EAS:

| Artifact Target | Format | Status | Expected Output Path | SHA-256 Checksum | Signature Status |
| :--- | :---: | :---: | :--- | :---: | :---: |
| **Android TV Leanback APK** | `.apk` | `PENDING_APPROVAL` | `build/streamlab-preview-tv.apk` | *Pending Build* | *Pending Build* |
| **Android Mobile APK** | `.apk` | `PENDING_APPROVAL` | `build/streamlab-preview-apk.apk`| *Pending Build* | *Pending Build* |
| **Android App Bundle (AAB)**| `.aab` | `PENDING_APPROVAL` | `build/streamlab-production.aab` | *Pending Build* | *Pending Build* |

---

## 2. ARTIFACT POST-BUILD VERIFICATION RUNBOOK

Once the approved EAS cloud build finishes and the binary is downloaded locally, the DevSecOps team must execute the following cryptographic and manifest verification suite before releasing the artifact to the physical device lab:

### 2.1 Cryptographic Signature Verification
```bash
# Verify APK Signature Scheme v2/v3 and print signing certificate fingerprints
apksigner verify --verbose --print-certs streamlab-preview-tv.apk
```
*Verification Requirement:* Must confirm `Verifies: true` under APK Signature Scheme v2 or v3, with valid SHA-256 certificate fingerprint.

### 2.2 Android Package Badging Audit
```bash
# Dump badging metadata from compiled APK using Android AAPT
aapt dump badging streamlab-preview-tv.apk
```
*Verification Requirements:*
* `package: name='com.streamlab.app'`
* `sdkVersion:'28'` (Min SDK 28 / Android 9.0)
* `targetSdkVersion:'34'` (Target SDK 34 / Android 14)
* `uses-feature: name='android.software.leanback' required='false'`
* `uses-permission: name='android.permission.INTERNET'`
* `uses-permission: name='android.permission.ACCESS_NETWORK_STATE'`

### 2.3 Checksum Registration
```bash
# Generate authoritative SHA-256 hash
sha256sum streamlab-preview-tv.apk > streamlab-preview-tv.apk.sha256
```

---

## 3. ARTIFACT INTEGRITY CONCLUSION

Artifact verification is classified as **`PENDING_APPROVAL`**. The verification tooling, manifest criteria, and signature verification protocols are established and ready for immediate execution upon artifact receipt.
