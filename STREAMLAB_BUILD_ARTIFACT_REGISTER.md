# STREAMLAB — BUILD ARTIFACT REGISTER
**Multi-Platform Target Status, Toolchain Analysis & Artifact Inventory**

* **Document ID:** BAR-PHASE14-STREAMLAB-2026  
* **Release Candidate:** `v1.0.0-rc1`  
* **Date:** November 1, 2026  
* **Author:** Build Automation & Release Engineering Lead  

---

## 1. Toolchain & Environment Forensic Audit

To ensure absolute adherence to the engineering principle of *"Evidence before conclusions"* and *"Never report a build as successful unless the artifact exists and the build process exits successfully"*, a full audit of the build host was executed:

| Toolchain Component | Host Current Version | Required Minimum Version | Build Capability Status |
| :--- | :--- | :--- | :---: |
| **Operating System** | Windows 11 Enterprise | Windows 10+ / Linux / macOS | **HOST SUPPORTED** |
| **Node.js Runtime** | Node v24.15.0 / npm 11.14.1 | Node v18+ | **COMPATIBLE** |
| **Java Development Kit** | OpenJDK 1.8.0_302 (Java 8) | JDK 17 (Java 17) | **INCOMPATIBLE FOR LOCAL GRADLE** |
| **Android SDK Path** | `C:\Users\gaura\AppData\Local\Android\Sdk` | API Level 34+ (Android 14) | **PRESENT (SDK Installed)** |
| **Android Platform Tools** | `platform-tools` (adb present) | API 34 Platform Tools | **PRESENT** |
| **Apple Xcode Toolchain** | Not Available (Windows Host) | Xcode 15+ (macOS only) | **INCOMPATIBLE FOR LOCAL IOS** |

### Toolchain Audit Finding:
- **Local Native Compilation:** React Native 0.76 and Expo 52 require **Java 17 (JDK 17)** to execute the Gradle build daemon. The Windows host is configured with OpenJDK 8 (`jdk-8.0.302.8-hotspot`). Compiling native `.apk` or `.aab` locally via `./gradlew assembleRelease` will halt with `UnsupportedClassVersionError` or Gradle compatibility errors until JDK 17 is installed.
- **iOS/tvOS Native Compilation:** Building `.ipa` or tvOS bundles locally requires macOS with Xcode.

---

## 2. Target Platform Artifact Register

| Target Platform | Package Format | Bundle Identifier | Native Manifest Configuration | Local Build Status | Recommended Release Pipeline |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **Android Mobile** | `.apk` / `.aab` | `com.streamlab.app` | Configured in `app.json` | **PRE-CONFIGURED** | EAS Build Cloud: `eas build -p android --profile production` |
| **Android TV** | Leanback `.apk` | `com.streamlab.app` | Intent: `LEANBACK_LAUNCHER` in `app.json` | **PRE-CONFIGURED** | EAS Build Cloud: `EXPO_TV=1 eas build -p android` |
| **Amazon Fire TV** | Fire OS `.apk` | `com.streamlab.app` | Android API 28+ Leanback compatible | **PRE-CONFIGURED** | EAS Build Cloud: `EXPO_TV=1 eas build -p android` |
| **iOS Mobile** | `.ipa` | `com.streamlab.app` | Configured in `app.json` | **PRE-CONFIGURED** | EAS Build Cloud / macOS CI: `eas build -p ios` |
| **Apple TV (tvOS)** | tvOS `.ipa` | `com.streamlab.app` | `isTV: true` in `app.json` | **PRE-CONFIGURED** | EAS Build Cloud / macOS CI: `EXPO_TV=1 eas build -p ios` |
| **Web Application** | SPA / PWA | `web` | React Native for Web | **BUILD READY** | `npx expo export:web` |
| **Backend Server** | Node.js | `@streamlab/server` | `server.js` (Standalone / Docker) | **VERIFIED RUNNING** | Docker / Node.js systemd service |

---

## 3. Standardized Production Build Procedures

### A. Android Release APK / AAB (via Expo Application Services - Recommended)
1. Install EAS CLI: `npm install -g eas-cli`
2. Authenticate: `eas login`
3. Configure build profile in `eas.json`:
   ```json
   {
     "build": {
       "production": {
         "android": {
           "buildType": "app-bundle"
         }
       },
       "preview-apk": {
         "android": {
           "buildType": "apk"
         }
       }
     }
   }
   ```
4. Run Build Command:
   * **Mobile Release Bundle (AAB):** `eas build --platform android --profile production`
   * **Android TV / Fire TV APK:** `eas build --platform android --profile preview-apk`

### B. Local Compilation on Dedicated Build Worker (Prerequisites)
1. Install JDK 17 (e.g. Eclipse Temurin 17 or Microsoft Build of OpenJDK 17).
2. Set Environment Variables:
   * `JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot`
   * `ANDROID_HOME=C:\Users\gaura\AppData\Local\Android\Sdk`
   * `PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%`
3. Generate native Android project:
   ```bash
   cd D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-app\mobile
   npx expo prebuild --platform android
   ```
4. Compile Release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   Artifact output: `android/app/build/outputs/apk/release/app-release.apk`
