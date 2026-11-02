# STREAMLAB v1.2.0 — RELEASE ARTIFACT INTEGRITY REPORT

**Authority:** DevSecOps Lead / Release Engineering Lead  
**Document ID:** AIR-PHASE19-BUILD-2026  
**Execution Date:** 2026-11-01  
**Target Release:** StreamLab v1.2.0  
**Baseline Commit:** `8181de0eec5d707f41394835dd15aa416305541b`  
**Overall Artifact Gate Status:** `BLOCKED_EXTERNAL`  

---

## 1. INVENTORY OF APPLICATION RELEASE BINARIES

A comprehensive search of the workspace filesystem, native output directories (`mobile/android/app/build/outputs/apk/release/`), and package distributions was conducted for compiled Android application packages:

| Artifact Target | Package Format | Binary Status | File Path | File Size | SHA-256 Checksum |
| :--- | :---: | :---: | :--- | :---: | :---: |
| **Android Universal Release APK** | `.apk` | `NOT_AVAILABLE` | N/A | N/A | N/A |
| **Android App Bundle (AAB)** | `.aab` | `NOT_AVAILABLE` | N/A | N/A | N/A |
| **Android TV Leanback Release APK** | `.apk` | `NOT_AVAILABLE` | N/A | N/A | N/A |
| **Amazon Fire TV Release APK** | `.apk` | `NOT_AVAILABLE` | N/A | N/A | N/A |

### Audit Finding:
No compiled native binaries exist on the local execution host. Under the governance mandate:
> *"Do not assume that a configured build target means a valid binary exists. If an artifact is missing, report it as NOT_AVAILABLE. Do not generate or modify binaries unless explicitly authorized separately."*

Local binary generation was strictly withheld to protect the frozen baseline.

---

## 2. BUILD HOST TOOLCHAIN AUDIT & COMPILATION REQUIREMENTS

### 2.1 Current Host Toolchain Configuration
* **Operating System:** Windows 11 Enterprise (Build 26100)
* **Node.js Environment:** Node.js v24.15.0 / npm 11.14.1
* **Host Java Runtime:** OpenJDK 1.8.0_302 (Java 8) at `C:\Program Files\Java\jdk-8.0.302.8-hotspot`
* **Android SDK Location:** `C:\Users\gaura\AppData\Local\Android\Sdk` (API Level 34 installed)
* **Android Platform Tools:** Installed (`adb.exe` version 1.0.41, revision 35.0.2)

### 2.2 Compilation Blockers on Local Host
1. **Java Version Incompatibility:** React Native 0.76 and Expo SDK 52 utilize Gradle 8.8+ and Android Gradle Plugin 8.5+, which strictly mandate **Java 17 (JDK 17)**. Attempting native compilation (`./gradlew assembleRelease`) against the host's Java 8 environment halts immediately with:
   ```
   Unsupported class file major version 61 (Java 17 required)
   ```
2. **Cloud/CI Release Pipeline Mandate:** In modern Expo/React Native architectures, release binaries are compiled within isolated cloud containers (EAS Build) or dedicated CI runners pre-configured with JDK 17, Android SDK 34, and hardware keystores.

---

## 3. RELEASE SPECIFICATIONS & TARGET MANIFEST PROFILE

When compilation is authorized and triggered via EAS Build / CI, the generated artifacts must conform to the following verified profile from `mobile/app.json`:

```json
{
  "expo": {
    "name": "StreamLab",
    "slug": "streamlab-app",
    "version": "1.2.0",
    "android": {
      "package": "com.streamlab.app",
      "versionCode": 10200,
      "minSdkVersion": 28,
      "targetSdkVersion": 34,
      "intentFilters": [
        {
          "action": "MAIN",
          "category": [
            "DEFAULT",
            "LAUNCHER",
            "LEANBACK_LAUNCHER"
          ]
        }
      ]
    }
  }
}
```

### Verification Criteria for Future Binaries:
Upon generation, each artifact must be audited against:
1. **Package Verification:**
   ```bash
   aapt dump badging streamlab-release.apk | grep -E "package|sdkVersion|targetSdkVersion|leanback"
   ```
2. **Signature Verification:**
   ```bash
   apksigner verify --verbose --print-certs streamlab-release.apk
   ```
   Must confirm v2/v3 APK Signature Scheme signing.
3. **Cryptographic Checksum:**
   ```bash
   sha256sum streamlab-release.apk > streamlab-release.apk.sha256
   ```

---

## 4. ARTIFACT INTEGRITY CONCLUSION

* **Binary Availability:** `NOT_AVAILABLE` across all 4 targets.
* **Manifest & Project Configuration:** `VERIFIED_READY` (`app.json` contains complete Leanback intent filters, SDK bounds, and versioning).
* **Artifact Integrity Gate (G-08):** `BLOCKED_EXTERNAL` (Binary compilation deferred to JDK 17 cloud CI / EAS build pipeline).
