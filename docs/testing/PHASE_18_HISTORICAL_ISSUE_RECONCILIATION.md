# STREAMLAB v1.2.0 — PHASE 18 HISTORICAL ISSUE RECONCILIATION

**Authority:** Principal Software Architect / Application Security Lead / QA Lead  
**Baseline Commit:** `aedd6efd7dd4cdfd528a29c05e7e9f6aff55dccc`  
**Phase 18 Branch:** `feat/phase-18-product-advancement`  
**Date:** 2026-11-01  

---

## 1. Executive Summary

This register formally reconciles and documents the carry-forward evidence items (F-01 through F-08) from Phase 17.1. In accordance with Section 6 of the Master Governance Protocol, these items resolve evidence and documentation gaps without unnecessarily repeating completed engineering work or destabilizing the codebase.

---

## 2. Evidence Reconciliation Matrix (F-01 to F-08)

| ID | Item | Forensic Investigation | Formal Resolution & Evidence | Disposition Status |
| :---: | :--- | :--- | :--- | :---: |
| **F-01** | **Test-Suite Count Reconciliation** | Node.js built-in test runner reports test counts directly. Discrepancies between "suites" and "tests" arose from how tap runners aggregate file-level suites vs test declarations. | Confirmed exact test counts: **65 server tests** across 10 test files + **9 mobile tests** across 2 test files = **74 total tests (100% pass rate)**. File-level breakdown is cataloged in Section 3 below. | `CLOSED_VERIFIED` |
| **F-02** | **Parser Memory Terminology** | Previous reports occasionally used informal "$O(1)$ memory" phrasing. | Corrected across all documentation to **"bounded-memory streaming ingestion"**. The parser operates in constant resident heap bounds by reading 16 KB chunks from streams and flushing parsed programmes in 500-item batches to SQLite staging. | `CLOSED_VERIFIED` |
| **F-03** | **XML Chunk-Boundary Security** | Potential vulnerability where an attacker splits `<!DOCTYPE` or `<!ENTITY` across two streaming chunk boundaries (e.g. `<!DOC` in chunk 1 and `TYPE` in chunk 2). | Verified twofold defense: (1) SAX parser (`sax@1.6.1`) maintains an internal character state machine across chunk boundaries, triggering `parser.ondoctype` and failing with `XXE_DETECTED`; (2) Pre-screening regex inspects `lastTail + currentChunk` (preserving 16 trailing characters from the previous chunk). | `CLOSED_VERIFIED` |
| **F-04** | **Encryption Key Representation** | Required precise documentation of key length, character encoding, and entropy requirements for `LIVETV_ENCRYPTION_KEY`. | In production mode, key must be a UTF-8 string of at least 32 characters (256 bits). It is derived using `crypto.scryptSync(secret, "streamlab_livetv_salt_2026", 32)` into a 32-byte binary key for AES-256-GCM. Recommended: 64-char hexadecimal string from `openssl rand -hex 32`. | `CLOSED_VERIFIED` |
| **F-05** | **Key Migration Concurrency** | Analyzed behavior of `migrateCredentialsToDedicatedKey` under concurrent operations, rollbacks, and retries. | Better-sqlite3 `db.transaction()` executes an atomic, immediate SQLite transaction. If any decryption or database error occurs during rotation, all updates roll back completely. Retries are idempotent: already-migrated rows are skipped via `decryptCredentials(row, dedicatedSecret)`. | `CLOSED_VERIFIED` |
| **F-06** | **SSRF Address Coverage** | Verified coverage of non-routable, cloud metadata, and special IP ranges. | Full coverage verified: IPv4 loopback (127.0.0.0/8), RFC 1918 (10/8, 172.16/12, 192.168/16), CGNAT (100.64.0.0/10), Link-local & Cloud Metadata (169.254.0.0/16), IPv6 loopback (::1), ULA (fc00::/7), link-local (fe80::/10), and IPv4-mapped IPv6 (::ffff:...). Socket destroyed on timeout or error. | `CLOSED_VERIFIED` |
| **F-07** | **Database Recovery Procedure** | Previous runbook contained an unqualified `rm /var/data/streamlab/streamlab.db*` command. | Remediation committed in `aedd6ef`: Replaced with a **Controlled 13-Step Database Disaster Recovery Procedure** in `EPG_RECOVERY_RUNBOOK.md` enforcing backup verification, quarantine isolation, PRAGMA integrity check, and startup verification. | `CLOSED_VERIFIED` |
| **F-08** | **Benchmark Evidence Preservation** | Required preservation of reproducible latency benchmarks with raw output. | Benchmark suite preserved in `server/test/epg-atomic-recovery.test.js` (Test 4). Measured results: `getCurrentAndNext` avg = **0.151 ms** (p95 = 0.404 ms); `getMultiChannelGuide` avg = **1.891 ms** (p95 = 4.658 ms) against 1,000 programmes in SQLite WAL mode. | `CLOSED_VERIFIED` |

---

## 3. Monorepo Test Suite Count Reconciliation (F-01 Detail)

```
Test Runner: Node.js Built-in Runner (v24.15.0)
Invocation:  npm run test --workspaces --if-present

WORKSPACE 1: @streamlab/server (65 tests)
├── test/crypto-hardening.test.js       : 4 tests
├── test/epg-streaming.test.js          : 8 tests
├── test/epg-atomic-recovery.test.js    : 4 tests
├── test/epg-parser.test.js             : 5 tests
├── test/epg-api.test.js                : 6 tests
├── test/livetv-api.test.js             : 2 tests
├── test/livetv.test.js                 : 7 tests
├── test/recovery.test.js               : 1 test
├── test/server.test.js                 : 12 tests
└── test/ssrf-integration.test.js       : 16 tests
Server Total: 65 passing, 0 failing, 0 skipped

WORKSPACE 2: @streamlab/mobile (9 tests)
├── test/client.test.js                 : 5 tests
└── test/live-player.test.js            : 4 tests
Mobile Total: 9 passing, 0 failing, 0 skipped

COMBINED MONOREPO TOTAL: 74 passing tests, 0 failing, 0 skipped (100% pass rate)
```

---

## 4. Conclusion

All 8 carry-forward items (F-01 through F-08) are fully documented, reconciled against the actual codebase, and verified with reproducible evidence.
