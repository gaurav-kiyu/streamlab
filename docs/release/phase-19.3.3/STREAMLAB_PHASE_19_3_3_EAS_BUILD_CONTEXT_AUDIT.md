# STREAMLAB v1.2.0 — PHASE 19.3.3 EAS BUILD CONTEXT AUDIT

**Authority:** DevSecOps Lead / Android Release Engineer  
**Project:** VIDEO_STREAMING_APP — StreamLab  
**Date:** 2026-11-01  
**Working Directory:** `D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-app`  

---

## 1. EAS MONOREPO WORKSPACE ARCHITECTURE

StreamLab is organized as an npm workspace monorepo:
* **Repository Root:** `package.json` defines `"workspaces": ["server", "mobile"]` with root `package-lock.json`.
* **Mobile Workspace:** `mobile/package.json` contains application dependencies (`react-native@0.76.2`, `expo@~52.0.0`, etc.).
* **EAS Configuration:** Both `eas.json` (root mirror) and `mobile/eas.json` define:
  ```json
  "preview-tv": {
    "distribution": "internal",
    "env": {
      "EXPO_TV": "1"
    },
    "android": {
      "buildType": "apk"
    }
  }
  ```

---

## 2. CLOUD BUILDER INSTALLATION & WORKING CONTEXT

When submitting an EAS build from the mobile workspace:
1. **Tarball Packaging:** EAS CLI identifies `mobile/` as the Expo project directory and the repository root as the npm workspace root. The entire repository (excluding gitignored files) is uploaded to the EAS builder VM.
2. **Dependency Installation:** EAS builder detects the root `package-lock.json` and executes `npm ci` at the monorepo root. This automatically hoists dependencies, links the `@streamlab/mobile` workspace, and resolves all 965 locked packages (including genuine `expo-secure-store@14.0.1`).
3. **Prebuild Invocation:** EAS executes Expo prebuild in `mobile/`, generating `mobile/android/` from `mobile/app.json`.
4. **Gradle Compilation:** EAS runs Gradle assemble (`./gradlew assembleRelease` or `./gradlew assemblePreview`), producing the signed `.apk` artifact.

---

## 3. EXACT EXPECTED BUILD COMMAND

```powershell
cd D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-app\mobile
npx eas-cli build --profile preview-tv --platform android
```

### Pre-Submission Execution Checklist:
```
[x] Root and mobile package manifests synchronized
[x] Root package-lock.json verified and locked
[x] Preview-tv profile configured for standalone APK
[ ] Mandatory branding assets committed to mobile/assets/ (BLOCKED)
[ ] Interactive EAS authentication completed (PENDING OPERATOR)
[ ] Project UUID configured in extra.eas.projectId (PENDING OPERATOR)
[ ] Human cloud build authorization granted (PENDING OPERATOR)
```

---
**Verdict:** BUILD CONTEXT AUDIT COMPLETE; PREREQUISITES DOCUMENTED  
**Audited By:** DevSecOps Lead  
