# STREAMLAB — LIVE TV DATABASE SCHEMA & MIGRATION SPECIFICATION
**Relational Data Model, Foreign Key Integrity, Indexing & Rollback Strategy**

* **Document ID:** DB-SCHEMA-PHASE16-2026
* **Status:** IMPLEMENTED & TEST-VERIFIED
* **Source Implementation:** `server/src/livetv/migrations.js`
* **Test Verification:** `server/test/livetv.test.js` (Test 3)

---

## 1. Schema Entity Relationship Diagram

The Live TV database architecture strictly enforces user and profile ownership to prevent multi-tenant data leakage:

```mermaid
erDiagram
    USERS ||--o{ LIVE_TV_PROVIDERS : owns
    PROFILES ||--o{ LIVE_TV_PROVIDERS : scoped_to
    LIVE_TV_PROVIDERS ||--o{ LIVE_TV_CHANNELS : contains
    USERS ||--o{ LIVE_TV_CHANNELS : owns
    PROFILES ||--o{ LIVE_TV_CHANNELS : scoped_to
    PROFILES ||--o{ LIVE_TV_FAVORITES : marks
    LIVE_TV_CHANNELS ||--o{ LIVE_TV_FAVORITES : favorited_in
    PROFILES ||--o{ LIVE_TV_HISTORY : tracks
    LIVE_TV_CHANNELS ||--o{ LIVE_TV_HISTORY : watched_in
    LIVE_TV_CHANNELS ||--o{ EPG_PROGRAMS : schedules
    LIVE_TV_PROVIDERS ||--o{ EPG_SYNC_JOBS : imports_for

    LIVE_TV_PROVIDERS {
        text id PK
        integer user_id FK
        integer profile_id FK
        text type
        text name
        text url
        text encrypted_credentials
        text epg_url
        integer enabled
        text created_at
    }

    LIVE_TV_CHANNELS {
        text id PK
        text provider_id FK
        integer user_id FK
        integer profile_id FK
        integer channel_number
        text name
        text logo_url
        text category
        text stream_url
        text tvg_id
        integer enabled
        text created_at
    }

    LIVE_TV_FAVORITES {
        integer id PK
        integer user_id FK
        integer profile_id FK
        text channel_id FK
        text created_at
    }

    LIVE_TV_HISTORY {
        integer id PK
        integer user_id FK
        integer profile_id FK
        text channel_id FK
        text watched_at
        integer duration_seconds
    }

    EPG_PROGRAMS {
        integer id PK
        text channel_id FK
        text tvg_id
        text title
        text description
        text start_utc
        text stop_utc
        text category
        text poster_url
    }

    EPG_SYNC_JOBS {
        text job_id PK
        integer user_id FK
        text provider_id FK
        text job_type
        text status
        integer channels_found
        integer channels_imported
        text started_at
        text expires_at
        text completed_at
        text error_message
    }
```

---

## 2. Table Specifications & Index Strategy

### 1. `live_tv_providers`
* Tracks user-configured Live TV sources (`playlist`, `official`, `jellyfin`).
* **Cascade Delete:** Deleting a provider automatically removes all associated channels, favorites, and schedule programs via `ON DELETE CASCADE`.

### 2. `live_tv_channels`
* Normalized channel definitions.
* **Indexes:**
  * `idx_live_tv_channels_provider` on `(provider_id)`
  * `idx_live_tv_channels_profile` on `(user_id, profile_id)`
  * `idx_live_tv_channels_category` on `(category)`

### 3. `live_tv_favorites`
* Profile-scoped favorite flags.
* **Unique Constraint:** `UNIQUE(profile_id, channel_id)` prevents duplicate favorites.

### 4. `live_tv_history`
* Chronological watch history for recently-watched channel rails.
* **Index:** `idx_live_tv_history_profile` on `(profile_id, watched_at DESC)` for sub-millisecond retrieval of the last 10 channels.

### 5. `epg_programs`
* Program timeline schedule indexed by UTC timestamps.
* **Index:** `idx_epg_programs_channel_time` on `(channel_id, start_utc, stop_utc)`.

### 6. `epg_sync_jobs`
* Persistent job locking table ensuring no duplicate concurrent imports execute for the same user account.
* **Index:** `idx_epg_sync_jobs_active` on `(user_id, status, expires_at)`.

---

## 3. Transactional Migration & Safe Rollback Procedure

All schema changes are tracked in `schema_migrations` with version `20261101_01_livetv_foundation`:
* **Up Migration:** Executes within `db.transaction(...)`. WAL mode and foreign keys remain active.
* **Down Rollback:** Drops all created tables and deletes the version record cleanly in reverse dependency order. Tested and verified in `server/test/livetv.test.js`.
