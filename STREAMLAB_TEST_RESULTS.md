# STREAMLAB — AUTOMATED TEST SUITE & REGRESSION RESULTS

**Execution Engine:** Node.js v24.15.0 Native Test Runner (`node:test`, `node:assert`)  
**Workspace:** Monorepo (`@streamlab/server` and `@streamlab/mobile`)  
**Date of Execution:** November 1, 2026  
**Status:** ALL TESTS PASSED (12 / 12)

---

## 1. BACKEND & SECURITY TEST SUITE (`server/test/server.test.js`)

```
> @streamlab/server@0.2.0 test
> node --test test/**/*.test.js

[StreamLab Security] Initial administrator account created:
  Username: admin
  Password: InitialAdminPassword123!
  IMPORTANT: You MUST change this temporary password at first login via /admin

✔ 1. System Health & Security Headers (56.1304ms)
✔ 2. Public Config Redaction (SEC-01 Fix Verification) (10.4243ms)
✔ 3. Authentication & Input Validation (196.2242ms)
✔ 4. Normal User Signup & Profile Creation (74.125ms)
✔ 5. Authorization Boundaries (Users cannot access Admin APIs) (77.6164ms)
✔ 6. Forced Password Change for Initial Admin (286.6632ms)
✔ 7. User Progress and Watchlist Cloud Synchronization (79.6271ms)

ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1356.5202
```

---

## 2. MOBILE CLIENT LOGIC & STORAGE SUITE (`mobile/test/client.test.js`)

```
> @streamlab/mobile@0.2.0 test
> node --test test/**/*.test.js

✔ 1. Indian Language Dictionary & Configuration Integrity (2.179ms)
✔ 2. Jellyfin Bitrate & Quality Mappings (0.2661ms)
✔ 3. Client Settings & SecureStore Isolation (SEC-04 Remediation) (0.4599ms)
✔ 4. Playback Position & Continue Watching Bounds (1.7972ms)
✔ 5. Watchlist (My List) Toggle Logic (0.6261ms)

ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 120.9175
```

---

## 3. REGRESSION SUMMARY

* **Total Tests Executed:** 12
* **Passed:** 12 (100%)
* **Failed:** 0 (0%)
* **Skipped / Todo:** 0
* **Combined Execution Duration:** ~1.48 seconds
* **Regression Verdict:** No regressions detected. Core functionality preserved across both workspaces.
