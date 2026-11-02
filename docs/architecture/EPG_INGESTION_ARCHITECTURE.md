# StreamLab — EPG Ingestion Architecture

**Version:** 1.1.0  
**Status:** Approved & Implemented  
**Subsystem:** Live TV & Electronic Program Guide (EPG)

---

## 1. Overview & Architectural Goals

The StreamLab Electronic Program Guide (EPG) ingestion subsystem is engineered to reliably ingest, parse, normalize, and query schedule metadata across hundreds of linear television channels. 

Key design imperatives:
1. **Zero Data Loss on Ingestion Failures:** A network timeout, malformed XML feed, or parsing error during an EPG sync must never wipe out or corrupt existing schedule data.
2. **Deterministic Time Normalization:** All feed timestamps with disparate offsets (`+0530`, `-0400`, `UTC`, `Z`, or un-offset) are converted to ISO 8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`) at ingestion time.
3. **High-Performance Querying:** EPG timeline lookups for 10-foot TV guides and mobile rails must execute in sub-millisecond SQLite time-window queries (`start_utc < ? AND stop_utc > ?`).
4. **Resilient Channel Mapping:** Robust channel matching against `tvg_id`, exact channel name, and fuzzy name matching.

---

## 2. Ingestion Pipeline & Staged Atomic Swap

StreamLab employs a two-stage transaction model separating parsing/staging from production presentation:

```
[XMLTV Feed (URL / Raw)]
          │
          ▼
┌───────────────────────────────┐
│  SSRF & Payload Gatekeeper    │  <-- Ceiling: 25 MB; SSRF DNS resolution
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│  Streaming SAX-Style Parser   │  <-- XXE & Billion Laughs Rejection
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│  epg_programs_staging Table   │  <-- Writes to isolated staging job rows
└──────────────┬────────────────┘
               │ (Upon successful parse & validation)
               ▼
┌───────────────────────────────┐
│      Atomic Transaction       │
│  1. Clear old EPG for mapped  │
│  2. Move staging -> prod      │
│  3. Clear staging rows        │
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│     epg_programs Table        │  <-- Available immediately to clients
└───────────────────────────────┘
```

### Staging Isolation (`epg_programs_staging`)
- Ingestion writes directly to `epg_programs_staging` indexed by `job_id`.
- If an exception occurs (e.g., malformed tag, parser exception, network cutoff), `discardStagedPrograms(jobId)` purges the temporary rows. Active `epg_programs` data remains 100% intact.
- Upon successful validation, `commitStagedPrograms(jobId, providerId)` executes an atomic SQLite transaction that deletes outdated records for the provider's channels and transfers the staging records into `epg_programs`.

---

## 3. Timestamp Normalization & UTC Standards

XMLTV feeds globally use non-standardized timestamp formats with varying offsets. StreamLab standardizes every timestamp at the parser boundary using `parseXmltvTimestamp(str)`:

| Feed Timestamp String | Parsed Timezone | Stored ISO 8601 UTC String |
| :--- | :--- | :--- |
| `20261101180000 +0530` | Indian Standard Time (IST) | `2026-11-01T12:30:00.000Z` |
| `20261101100000 -0400` | Eastern Daylight Time (EDT) | `2026-11-01T14:00:00.000Z` |
| `20261101120000 +0000` | Coordinated Universal Time | `2026-11-01T12:00:00.000Z` |
| `20261101120000 Z` | Zulu / UTC | `2026-11-01T12:00:00.000Z` |
| `20261101120000` | Default UTC Fallback | `2026-11-01T12:00:00.000Z` |

By storing all timestamps uniformly in UTC, client and server time-window comparisons are purely lexicographical and timezone-independent.

---

## 4. Channel Resolution & Deduplication

EPG programs map to channels via a multi-tier fallback:
1. **Explicit `tvg_id` Match:** Primary matching key linking `<programme channel="...">` to `live_tv_channels.tvg_id`.
2. **Exact Channel Name:** Fallback to lowercase channel name comparison.
3. **Fuzzy Substring Match:** Fallback to token substring matching for minor broadcaster naming variances.

### Deduplication
XMLTV feeds frequently contain overlapping or repeated programme intervals. The parser maintains a deduplication key `(channelId, startUtc, stopUtc)` during ingestion to ensure that duplicate entries are ignored prior to database insertion.

---

## 5. Retention & Cleanup Strategy

Historical EPG programs older than 48 hours are automatically purged using `epgRepo.cleanupOldPrograms(retentionHours)`:
```sql
DELETE FROM epg_programs WHERE stop_utc < datetime('now', '-48 hours');
```
This ensures the database remains compact and index lookups remain sub-millisecond even with continuous background updates.
