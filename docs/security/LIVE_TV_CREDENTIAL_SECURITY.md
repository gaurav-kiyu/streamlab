# STREAMLAB — LIVE TV CREDENTIAL SECURITY & SENSITIVE DATA GOVERNANCE
**AES-256-GCM Storage, URL Token Masking & Redaction Specifications**

* **Document ID:** SEC-CREDS-PHASE16-2026
* **Status:** IMPLEMENTED & TEST-VERIFIED
* **Source Implementation:** `server/src/livetv/crypto.js`
* **Test Verification:** `server/test/livetv.test.js` (Test 1)

---

## 1. Threat Profile: IPTV Credentials & Sensitive URIs

Commercial IPTV subscriptions and private streaming servers frequently pass credentials in vulnerable formats:
1. **HTTP Basic Auth:** `http://user:password@streamserver.tv:8080/live.m3u8`
2. **Query String Tokens:** `https://streamserver.tv/live.m3u8?token=xyz123&auth=secret999`
3. **Path-Based Credentials (Xtream Codes API standard):** `http://streamserver.tv/live/user/password/channelId.m3u8`

If stored in plaintext or logged to stdout, database backups or container log aggregation tools (Datadog, CloudWatch, Papertrail) will expose sensitive user credentials.

---

## 2. Multi-Tiered Credential Protection Architecture

StreamLab enforces a three-tier defense for all credentialed streams:

```mermaid
flowchart LR
    RawInput[User Ingests IPTV URL] --> Redactor[URL Redactor]
    Redactor --> DBDisplay[(live_tv_providers.url REDACTED)]
    
    RawInput --> Encryptor[AES-256-GCM Key Derivation]
    Encryptor --> DBCreds[(live_tv_providers.encrypted_credentials)]
    
    RawInput --> StreamExecutor[Client Player Direct Connect]
```

### Tier 1: Hardware-Derived AES-256-GCM Encryption
* **Key Derivation:** A 256-bit AES key is derived from the server's master `JWT_SECRET` using `crypto.scryptSync(secret, "streamlab_livetv_salt_2026", 32)`.
* **Authenticated Encryption:** Each credential bundle is encrypted with an ephemeral 12-byte initialization vector (`crypto.randomBytes(12)`).
* **Tamper Proofing:** The GCM mode generates a 16-byte authentication tag (`cipher.getAuthTag()`). Any unauthorized alteration of the database row results in decryption failure.
* **Storage Schema:**
  ```json
  {
    "iv": "3a4f89b...",
    "tag": "e7c19a4...",
    "data": "99db04f..."
  }
  ```

### Tier 2: Display & Logging URL Redaction
Before any URL is persisted into user-visible database fields (`live_tv_providers.url`) or written to the `audit` log table, it passes through `redactUrl()`:
1. **HTTP Basic Auth:** Passwords replaced with `REDACTED`.
2. **IPTV Path Redaction:** In path patterns `/live/{user}/{pass}/{id}`, segment 3 is replaced with `REDACTED`.
3. **Query Parameter Stripping:** Any query parameter matching `token`, `password`, `key`, `auth`, `api_key`, or `secret` has its value overwritten with `REDACTED`.

### Tier 3: Zero-Logging Policy for Stream Payloads
* The server logger never outputs parsed stream URLs or manifest contents.
* Audit entries record only provider metadata: `Provider: FAST News (playlist), 50 channels imported`.
