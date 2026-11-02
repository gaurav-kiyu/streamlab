# StreamLab v1.1.0 — Phase 17.1 Security Findings & Verification

**Subsystem:** Application Security, Cryptography & Threat Prevention  
**Status:** Certified & Hardened  
**Date:** 2026-11-01  

---

## 1. Cryptographic Key Management Audit

### A. Production LIVETV_ENCRYPTION_KEY Mandatory Enforcement
- **Vulnerability Identified in Audit:** Deriving encryption keys from `JWT_SECRET` created operational entanglement where rotating user session secrets invalidated stored IPTV subscription credentials. Additionally, allowing silent fallback in production compromised key segregation.
- **Remediation Implemented:**
  - `resolveLiveTvSecret()` strictly enforces that `LIVETV_ENCRYPTION_KEY` (min 32 characters) must be defined when `NODE_ENV === "production"`. Silent fallback throws `FATAL_CONFIG_ERROR`.
  - Non-production fallback to `JWT_SECRET` issues a visible warning log.
- **Zero-Downtime Rotation:** Dual keyring support `{ current, previous }` enables credentials encrypted under a retiring key to be decrypted seamlessly while new writes use the primary key.
- **Legacy Migration:** `migrateCredentialsToDedicatedKey(db, legacySecret, dedicatedSecret)` atomically re-encrypts all database records within a single SQLite transaction with verified pre- and post-decryption checks.

### B. AES-256-GCM Implementation
- Every encryption operation generates 12 bytes of cryptographically random entropy via `crypto.randomBytes(12)` as the Initialization Vector (IV).
- Verified that two identical payloads produce completely distinct IVs and ciphertexts.
- Authentication tags (16 bytes) are strictly verified. Flipping a single bit or character in ciphertext or tag immediately raises `DECRYPTION_FAILED`.

---

## 2. XMLTV Ingestion Threat Modeling & Protections

| Threat Vector | Attack Mechanism | StreamLab Defensive Control | Automated Verification |
| :--- | :--- | :--- | :--- |
| **XXE Injection** | `<!ENTITY xxe SYSTEM "file:///etc/passwd">` | Pre-tokenization signature block and SAX `ondoctype` handler throw `XXE_DETECTED`. Zero external resolution. | `epg-parser.test.js`, `epg-streaming.test.js` |
| **Billion Laughs (DoS)** | Recursive entity definitions (`&lol2;`) | Strictly prohibits `<!DOCTYPE` and `<!ENTITY` definitions entirely. | `epg-parser.test.js` |
| **Deep XML Nesting** | `<l1><l2>...<l40>` stack exhaustion | Parser enforces `depth <= maxDepth` (default: 32). Throws `MAX_DEPTH_EXCEEDED`. | `epg-streaming.test.js` |
| **Oversized Text Nodes** | 50 MB CDATA or single text node | Enforces `text.length <= maxTextLength` (default: 32 KB). Throws `TEXT_NODE_TOO_LARGE`. | `epg-streaming.test.js` |
| **Payload Memory Exhaustion** | 100 MB stream submission | Enforces `bytesRead <= maxBytes` (default: 25 MB). Destroys stream and throws `EPG_PAYLOAD_TOO_LARGE`. | `epg-streaming.test.js` |

---

## 3. SSRF & Network Transport Protections

1. **IP Range Filtering:**
   - Blocks IPv4 Loopback (`127.0.0.0/8`), Broadcast (`255.255.255.255`), Unspecified (`0.0.0.0/8`).
   - Blocks RFC 1918 Private Ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
   - Blocks Cloud Metadata & Link-Local (`169.254.169.254`, `fe80::/10`).
   - Blocks IPv4-Mapped IPv6 in both dotted decimal (`::ffff:127.0.0.1`) and hex (`::ffff:7f00:0001`).
   - Blocks IPv6 Unique Local (`fc00::/7`, `fd00::/7`).
2. **DNS Rebinding Defense:**
   - `validateAndPinUrl()` resolves hostnames using `dns.lookup({ all: true })`. If any resolved address is private, the request is rejected immediately (mixed DNS defense).
   - The verified public IP is pinned to the socket via custom agent `lookup`, ensuring the connected socket uses the exact validated IP.
3. **Redirect Loop & Limit Defense:**
   - Tracks visited URLs in a `Set`. Recurring URLs trigger `REDIRECT_LOOP`.
   - Maximum redirects capped at 3 (`TOO_MANY_REDIRECTS`).
   - Every redirect location is independently validated and DNS-resolved against the SSRF guard.
4. **Decompression Bomb Protection:**
   - Transparently handles `gzip` and `deflate` responses.
   - Enforces `maxBytes` on decompressed output stream. Decompressing beyond 25 MB aborts immediately with `PAYLOAD_TOO_LARGE`.
