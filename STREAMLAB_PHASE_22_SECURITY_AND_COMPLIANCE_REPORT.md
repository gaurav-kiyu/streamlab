# STREAMLAB v1.2.0 — PHASE 22.7
# SECURITY, LICENSING & REGULATORY COMPLIANCE REPORT

**Authority:** Application Security Lead / DevSecOps Lead / Principal Software Architect  
**Date:** November 2, 2026  
**Status:** AUDITED & CERTIFIED  
**Application:** StreamLab v1.2.0 (`com.streamlab.app`)  

---

## 1. COMPREHENSIVE SECURITY AUDIT CHECKLIST

```
┌────────────────────────────────────────────────────────────────────────┐
│                     SECURITY & COMPLIANCE SCORECARD                    │
├──────────────────────────────────┬─────────────────┬───────────────────┤
│ Verification Area                │ Requirement     │ Status            │
├──────────────────────────────────┼─────────────────┼───────────────────┤
│ 1. TMDB API Secret Isolation     │ Backend-only    │ PASS (CONFIRMED)  │
│ 2. SSRF Protection               │ No proxy URLs   │ PASS (CONFIRMED)  │
│ 3. Deep-Link Scheme Allowlist    │ Safe protocols  │ PASS (CONFIRMED)  │
│ 4. TMDB Attribution Notice       │ On-screen logo  │ PASS (CONFIRMED)  │
│ 5. JustWatch Attribution Notice  │ On-screen credit│ PASS (CONFIRMED)  │
│ 6. DRM Non-Circumvention         │ Zero decryption │ PASS (CONFIRMED)  │
│ 7. Rate Limiting & Timeouts      │ 6s AbortSignal  │ PASS (CONFIRMED)  │
│ 8. User Privacy & Multi-Profile  │ Profile Sandbox │ PASS (CONFIRMED)  │
└──────────────────────────────────┴─────────────────┴───────────────────┘
```

---

## 2. DETAILED SECURITY CONTROLS AUDIT

### 2.1 Backend Credential Isolation
* **Zero Client Secrets:** The TMDB API key is never bundled into the mobile source code, committed to Git, or exposed in public configuration.
* **Server Redaction:** Endpoint `GET /api/config` redacts `tmdbKey` and `jfUrl` from unauthenticated client payloads.
* **Client-Key Mode Security:** If an advanced user configures a personal TMDB key in the mobile app settings, it is stored in encrypted hardware-backed storage (`expo-secure-store`) and never transmitted to the StreamLab server.

### 2.2 Deep-Link Injection Defense & Scheme Allowlisting
To prevent intent redirection vulnerabilities, malicious scheme execution, or local file extraction, `validateExternalUrl` in `mobile/src/providers.js` enforces a strict allowlist:
* **Permitted:** `https://` universal links and certified native OTT schemes (`hotstar://`, `primevideo://`, `nflx://`, `sonyliv://`, `zee5://`, `sunnxt://`, `aha://`, `hoichoi://`, `etvwin://`, `mxplayer://`, `manoramamax://`, `chaupal://`, `planetmarathi://`, `wavespb://`).
* **Blocked:** `http://` (insecure unencrypted), `javascript:` (XSS), `data:` (payload injection), `file:` (local storage access), `intent:` (arbitrary Android intent crafting).

### 2.3 Upstream Proxy SSRF Guard
* **No Arbitrary Upstream Targets:** The server proxy never accepts target URLs from the client. It only executes predefined paths against `https://api.themoviedb.org/3`.
* **Parameter Allowlisting:** Unknown or suspicious query parameters are stripped before the upstream request is constructed.

### 2.4 Denial of Service (DoS) & Memory Exhaustion Protection
* **Request Timeout:** All upstream HTTP calls utilize `AbortSignal.timeout(6000)`. If TMDB hangs or experiences latency spikes, the request aborts after 6 seconds and returns `504 Gateway Timeout` rather than exhausting server sockets.
* **Bounded LRU Cache:** The cache is bounded to 500 entries, preventing memory exhaustion under high query cardinality.

---

## 3. THIRD-PARTY LICENSING & REGULATORY COMPLIANCE

### 3.1 TMDB API Terms of Use
* StreamLab complies with TMDB API Terms by explicitly displaying the required disclaimer:
  > *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
* The application utilizes TMDB solely for non-exclusive discovery metadata.

### 3.2 JustWatch Attribution Terms
* Where watch availability data is rendered in the UI, StreamLab displays:
  > *"Streaming availability data powered by JustWatch."*

### 3.3 Copyright & Content Rights
* **No Scraped Streams:** StreamLab does not scrape, stream, or re-transmit copyright-protected media from any commercial OTT platform.
* **Direct Playback Integrity:** Direct playback is restricted to user-configured personal media (Jellyfin), public-domain archives (Internet Archive), and authorized test streams.
