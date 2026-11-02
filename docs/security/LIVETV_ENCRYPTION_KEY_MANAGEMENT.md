# StreamLab — Live TV Encryption Key Management & Rotation

**Version:** 1.1.0  
**Status:** Approved & Implemented  
**Subsystem:** Cryptographic Key Management & Data Protection

---

## 1. Architectural Purpose

In Phase 16, IPTV provider credentials and tokens were encrypted with AES-256-GCM using a key derived from `process.env.JWT_SECRET`. While functional, coupling data-at-rest encryption to authentication session secrets creates severe operational hazards:
1. Rotating `JWT_SECRET` (e.g. to invalidate compromised user sessions) irreversibly breaks decryption of all stored IPTV provider credentials in the database.
2. An authentication secret rotation should never cause permanent data corruption of user subscriptions.

In Phase 17, StreamLab decoupled credential encryption into a dedicated cryptographic subsystem with key versioning and seamless rotation.

---

## 2. Key Resolution Hierarchy

Key resolution is governed by `resolveLiveTvSecret(fallbackSecret)` in `server/src/livetv/crypto.js`:

```
               [Application Startup]
                         │
                         ▼
           ┌───────────────────────────┐
           │ LIVETV_ENCRYPTION_KEY     │
           │ (Dedicated Key, >= 32 ch) │
           └─────────────┬─────────────┘
                         │
          ┌──────────────┴──────────────┐
     Set and Valid                  Missing or Short
          │                             │
          ▼                             ▼
┌──────────────────┐          ┌───────────────────────────┐
│ Use Dedicated    │          │ Fallback to JWT_SECRET    │
│ Encryption Key   │          │ (Backward Compatibility)  │
└──────────────────┘          └───────────────────────────┘
```

1. **Primary Dedicated Key (`LIVETV_ENCRYPTION_KEY`):** Must be configured in the production environment with a minimum of 32 cryptographically secure characters.
2. **Fallback Key (`JWT_SECRET`):** If `LIVETV_ENCRYPTION_KEY` is omitted, the system falls back to `JWT_SECRET` with an informational security log to maintain complete backward compatibility with existing databases.

---

## 3. Cryptographic Bundle & Key Versioning

All encrypted payloads produced by `encryptCredentials(data, secret, version = 1)` follow a structured JSON schema:

```json
{
  "v": 1,
  "iv": "3a7b...12bytesHex...",
  "tag": "8f1c...16bytesHex...",
  "data": "a0d4...ciphertextHex..."
}
```

- **`v` (Version Identifier):** Enables the decryption engine to determine the appropriate rotation key or cipher specification.
- **`iv` (Initialization Vector):** 12 bytes of cryptographically random entropy generated via `crypto.randomBytes(12)` per encryption operation (prevents IV reuse in GCM mode).
- **`tag` (Authentication Tag):** 16 bytes of GCM authentication tag verifying ciphertext integrity and detecting tampering.
- **`data` (Ciphertext):** AES-256-GCM ciphertext payload.

---

## 4. Zero-Downtime Key Rotation Protocol

To rotate encryption keys without service interruption:
1. Provide the key pair to the rotation utility or environment as `{ current: NEW_KEY, previous: OLD_KEY }`.
2. When reading credentials, `decryptCredentials()` attempts decryption with `current`. If tag verification fails, it transparently falls back to `previous`.
3. Background migration re-encrypts all database records with `v = 2` under `NEW_KEY`.
4. Once all records are upgraded, `previous` is decommissioned.
