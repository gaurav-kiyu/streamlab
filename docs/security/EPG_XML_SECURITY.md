# StreamLab — EPG XML Ingestion Security

**Version:** 1.1.0  
**Status:** Certified & Hardened  
**Subsystem:** Application Security & Threat Prevention

---

## 1. Threat Landscape for EPG Feeds

Electronic Program Guide (EPG) feeds are universally formatted in XML (XMLTV specification). Processing untrusted third-party XML feeds introduces severe attack vectors:
1. **XML External Entity (XXE) Injection:** An attacker crafts `<!ENTITY xxe SYSTEM "file:///etc/passwd">` or `SYSTEM "http://169.254.169.254/latest/meta-data/"` to extract local system files or query cloud metadata services.
2. **Billion Laughs / Entity Expansion (CWE-776):** Recursive entity definitions (`<!ENTITY lol2 "&lol;&lol;&lol;...">`) that expand exponentially in memory, causing instant heap exhaustion and process crash (Denial of Service).
3. **Quadratic Blowup:** Extremely large XML payloads designed to trigger CPU denial of service during document parsing.
4. **Server-Side Request Forgery (SSRF):** Feed URLs pointing to loopback addresses (`127.0.0.1`, `::ffff:7f00:0001`), internal subnets, or metadata services.

---

## 2. Multi-Layer Defensive Implementation

StreamLab applies strict defense-in-depth controls at every step of feed processing:

### A. Pre-Parse Doctype and Entity Prohibition
Before any XML tokenization begins, the parser validates the raw document buffer against entity and DTD signatures:
```javascript
// epg-parser.js
if (/<(!DOCTYPE|!ENTITY)/i.test(xmlContent)) {
  const err = new Error("Security Violation: DTD and external entities are prohibited in XMLTV feeds");
  err.code = "XXE_DETECTED";
  throw err;
}
```
Any feed containing `<!DOCTYPE` or `<!ENTITY` is aborted immediately with zero external resolution or memory expansion.

### B. Payload Size Ceiling Enforcement
EPG files can legitimately reach several megabytes for large cable networks, but unrestricted payloads invite memory exhaustion. StreamLab enforces a strict 25 MB payload ceiling:
```javascript
// epg-parser.js
const MAX_EPG_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

if (Buffer.byteLength(xmlContent, "utf8") > maxBytes) {
  const err = new Error(`XMLTV payload exceeded maximum allowed size of ${maxBytes} bytes`);
  err.code = "EPG_PAYLOAD_TOO_LARGE";
  throw err;
}
```

### C. Zero Third-Party Parser Vulnerabilities
Rather than relying on C-bound XML parsers (e.g. `libxml2`) that carry historical CVE liabilities, StreamLab uses a pure JavaScript streaming regular expression tokenizer with character boundary limits and character entity unescaping (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`).

### D. SSRF Guard on Remote XMLTV URLs
Remote XMLTV URLs are retrieved exclusively through `secureFetch()` backed by `ssrf.js`:
- Blocks IPv4 loopback (`127.0.0.0/8`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and link-local ranges (`169.254.0.0/16`).
- Decodes and blocks hex-formatted IPv4-mapped IPv6 loopbacks (`::ffff:7f00:0001`).
- Enforces redirect loop detection with a visited URL set.
- Enforces strict socket connection and response body timeouts (15 seconds).

---

## 3. Automated Verification Evidence

The security mechanisms are validated in automated test suites:
- `test/epg-parser.test.js`: Confirms rejection of XXE system entity and Billion Laughs recursive entity payloads.
- `test/epg-api.test.js`: Confirms rejection of malicious XML submitted to the `/api/livetv/epg/import` endpoint with `400 XXE_DETECTED`.
