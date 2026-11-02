# STREAMLAB — APPLICATION SECURITY VERIFICATION REPORT

**Standard:** OWASP MASVS (Mobile Application Security) & OWASP ASVS (Application Security Verification)  
**Date:** November 1, 2026  
**Auditor:** Antigravity Application Security Group  
**Status:** ALL VULNERABILITIES REMEDIATED & VERIFIED

---

## 1. VULNERABILITY REMEDIATION VERIFICATION

### SEC-01 (CRITICAL): Public API Key Exposure
* **Affected Endpoint:** `GET /api/config`
* **Vulnerability:** Returned administrator's private `tmdbKey` and `jfUrl` in unauthenticated JSON responses.
* **Remediation:** 
  1. Defined `getPublicConfig()` in `server/server.js` which filters through a strict whitelist of safe UI flags (`showArchiveRows`, `downloadsEnabled`, `signupEnabled`, `guestBrowsingEnabled`, `defaultQuality`, `dataSaverDefault`, `announcement`, `maintenanceMode`, `maintenanceMessage`).
  2. Implemented server-side TMDB proxy endpoints (`GET /api/tmdb/discover` and `GET /api/tmdb/search`), keeping the TMDB API key strictly on the server.
* **Verification Evidence:** `server.test.js` Test #2 ("Public Config Redaction"): Asserts `res.data.tmdbKey === undefined` and `res.data.jfUrl === undefined` after injecting an active key into SQLite config table. Result: **PASSED**.

### SEC-02 (HIGH): Hardcoded Static Default Administrator Credentials
* **Affected File:** `server/server.js`
* **Vulnerability:** Hardcoded `DEFAULT_ADMIN = { username: "admin", password: "Admin@12345" }` seeded on first boot.
* **Remediation:**
  1. Removed static password.
  2. Database seeding now checks `process.env.ADMIN_INITIAL_PASSWORD`. If absent, generates a 16-character cryptographically random one-time password via `crypto.randomBytes()`.
  3. Enforces `must_change = 1`. The administrator cannot invoke any administrative APIs until their password has been changed.
* **Verification Evidence:** `server.test.js` Test #6: Initial admin login succeeds with `mustChange: true`, blocked from `/api/admin/stats` with `MUST_CHANGE_PASSWORD` code, allowed only after invoking `/api/auth/change-password`. Result: **PASSED**.

### SEC-03 (HIGH): Missing Admin Dashboard File (Denial of Service)
* **Affected Endpoint:** `GET /admin`
* **Vulnerability:** Express attempted to serve `public/admin.html` which was missing from the filesystem, causing HTTP 500 errors.
* **Remediation:** Built a modern, self-contained single-page application at `server/public/admin.html` with authenticated access, statistics, user management, and configuration controls.
* **Verification Evidence:** Physical verification of `server/public/admin.html` file existence, CSS/JS structure, and successful routing. Result: **PASSED**.

### SEC-04 (MEDIUM): Plaintext Storage of Sensitive Credentials on Mobile
* **Affected File:** `src/settings.js`
* **Vulnerability:** `tmdbKey` and `jfUrl` saved directly to unencrypted `AsyncStorage`.
* **Remediation:** Isolated `jfPass`, `tmdbKey`, and authentication tokens (`userAuthToken`) into platform-native `SecureStore` (Android Keystore / iOS Keychain).
* **Verification Evidence:** `client.test.js` Test #3: Verified `AsyncStorage.getItem("settings")` contains only non-sensitive preferences (`lang`, `quality`, `dataSaver`), while `SecureStore` stores `jfPass` and `tmdbSecretKey`. Result: **PASSED**.

### SEC-05 (MEDIUM): Unbounded Memory Map Rate Limiting
* **Affected File:** `server/server.js`
* **Vulnerability:** In-memory `Map` lacked capacity bounding, allowing denial of service via memory exhaustion during IP spoofing attacks.
* **Remediation:** Implemented `checkRateLimit()` with `MAX_RATE_LIMIT_KEYS = 5000`, automatic expired-record purging, and LRU eviction when size threshold is reached.
* **Verification Evidence:** Tested rate limiter with automated requests. Result: **PASSED**.

### SEC-06 (LOW): Missing HTTP Security Headers
* **Affected File:** `server/server.js`
* **Vulnerability:** Express app lacked standard clickjacking, MIME-type sniffing, and CSP defenses.
* **Remediation:** Mounted `helmet` middleware configuring `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store` on all API responses.
* **Verification Evidence:** `server.test.js` Test #1: Verified `nosniff` and `no-store` headers present on all responses. Result: **PASSED**.

---

## 2. SECURITY POSTURE SUMMARY
* **Critical Vulnerabilities Remaining:** 0
* **High Vulnerabilities Remaining:** 0
* **Medium Vulnerabilities Remaining:** 0
* **Residual Risk:** Low (Local SQLite storage; recommended to use reverse-proxy with TLS in public production deployments).
