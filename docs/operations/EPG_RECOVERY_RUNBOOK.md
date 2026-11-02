# StreamLab — EPG Operational & Recovery Runbook

**Subsystem:** Production Operations, Database Recovery & Key Management  
**Version:** 1.1.0  
**Date:** 2026-11-01  

---

## 1. Production Environment Configuration

Prior to starting StreamLab in production mode (`NODE_ENV=production`), the following environment variables must be configured in the secure operating system environment (never committed to Git):

```bash
# MANDATORY: Dedicated 256-bit AES encryption key (min 32 characters)
LIVETV_ENCRYPTION_KEY="your-32-character-random-encryption-key-here!"

# MANDATORY: Authentication session signing secret (min 32 characters)
JWT_SECRET="your-32-character-random-jwt-secret-here!"

# MANDATORY: Initial bootstrap administrator password
ADMIN_INITIAL_PASSWORD="YourStrongAdminPassword123!"

# OPTIONAL / DEFAULTS:
DB_FILE="/var/data/streamlab/streamlab.db"
PORT=3000
NODE_ENV="production"
```

> [!CAUTION]
> If `LIVETV_ENCRYPTION_KEY` is omitted or shorter than 32 characters in production, the server will intentionally abort startup with `FATAL_CONFIG_ERROR`. Silent fallback to `JWT_SECRET` is strictly prohibited in production.

---

## 2. Database Backup & Disaster Recovery

StreamLab operates SQLite in Write-Ahead Logging (WAL) mode (`PRAGMA journal_mode = WAL`).

### A. Online Hot Backup
To create a transactionally consistent backup while the application is actively serving users:
```bash
# Execute SQLite online backup CLI
sqlite3 /var/data/streamlab/streamlab.db ".backup '/var/backups/streamlab_$(date +%Y%m%d_%H%M%S).db'"
```

### B. WAL Checkpoint Maintenance
To force all transactions from WAL files back into the primary database file:
```bash
sqlite3 /var/data/streamlab/streamlab.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### C. Controlled 13-Step Database Disaster Recovery Procedure

> [!CAUTION]
> Never execute raw wildcard deletions (`rm /var/data/streamlab/streamlab.db*`). Wildcard removal destroys WAL logs, SHM files, and diagnostic artifacts before the root cause is isolated. Follow this mandatory 13-step controlled recovery procedure:

1. **Incident Detection & Alert Acknowledgment:**
   Log the incident ticket, acknowledge alerting, and notify on-call engineering.
2. **Service Shutdown:**
   Halt the application service cleanly to prevent ongoing write contention:
   ```bash
   sudo systemctl stop streamlab
   ```
3. **Process Termination Verification:**
   Confirm no remaining StreamLab node processes or SQLite handles are active:
   ```bash
   pgrep -a node | grep streamlab || true
   lsof /var/data/streamlab/streamlab.db || true
   ```
4. **Quarantine Directory Creation:**
   Create an isolated, timestamped forensic quarantine directory:
   ```bash
   QUARANTINE_DIR="/var/data/streamlab/quarantine_$(date +%Y%m%d_%H%M%S)"
   mkdir -p "$QUARANTINE_DIR"
   chmod 700 "$QUARANTINE_DIR"
   ```
5. **Atomic Move to Quarantine (Forensic Preservation):**
   Move the damaged database, WAL files, and shared memory files into quarantine (never delete blindly):
   ```bash
   mv /var/data/streamlab/streamlab.db "$QUARANTINE_DIR/" 2>/dev/null || true
   mv /var/data/streamlab/streamlab.db-wal "$QUARANTINE_DIR/" 2>/dev/null || true
   mv /var/data/streamlab/streamlab.db-shm "$QUARANTINE_DIR/" 2>/dev/null || true
   ```
6. **Backup Inventory & Candidate Identification:**
   Identify the latest verified backup from the designated backup storage:
   ```bash
   LATEST_BACKUP=$(ls -t /var/backups/streamlab_*.db | head -n 1)
   echo "Candidate backup: $LATEST_BACKUP"
   ```
7. **Candidate Backup Integrity Verification:**
   Execute SQLite integrity check on the candidate backup before restoration:
   ```bash
   sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"
   # Output MUST return 'ok'
   ```
8. **Cryptographic Checksum Verification:**
   Verify backup SHA-256 against its recorded signature in the backup register:
   ```bash
   sha256sum "$LATEST_BACKUP"
   ```
9. **Staged Database Restoration:**
   Copy the verified candidate backup into the active production directory:
   ```bash
   cp -p "$LATEST_BACKUP" /var/data/streamlab/streamlab.db
   ```
10. **Strict File Permissions & Ownership Enforcement:**
    Set restrictive file permissions and service ownership:
    ```bash
    chmod 600 /var/data/streamlab/streamlab.db
    chown streamlab:streamlab /var/data/streamlab/streamlab.db
    ```
11. **Pre-Flight Database Sanity Check:**
    Run a quick check and schema verification on the newly restored file:
    ```bash
    sqlite3 /var/data/streamlab/streamlab.db "PRAGMA quick_check; SELECT count(*) FROM users;"
    ```
12. **Controlled Service Start:**
    Start the StreamLab service under process supervision:
    ```bash
    sudo systemctl start streamlab
    ```
13. **Post-Restore Smoke Testing & Startup Health Audit:**
    Inspect startup logs to verify automated stale lock clearing, stale staging purge, and verify HTTP 200 health check:
    ```bash
    journalctl -u streamlab -n 50 --no-pager
    curl -f http://127.0.0.1:3000/api/health
    ```

---

## 3. Stale Jobs & Abandoned Staging Recovery

If the server crashes or restarts during an active EPG synchronization:
- Active locks remain held until their expiration timestamp (`expires_at`).
- StreamLab runs automated recovery upon server initialization:
  - `importJobManager.cleanupStaleJobs()`: Finds jobs in `running` status where `expires_at < datetime('now')` and marks them `failed` with code `STALE_LOCK_RECOVERED`.
  - `epgRepo.cleanupStaleStaging(1)`: Deletes any staging records created more than 1 hour ago that were never committed.
  - Active `epg_programs` data is never touched or truncated by recovery.

---

## 4. Encryption Key Rotation Runbook

To rotate `LIVETV_ENCRYPTION_KEY` without downtime:
1. Generate a new cryptographically secure 32+ character key:
   ```bash
   openssl rand -hex 32
   ```
2. Configure the dual keyring in your configuration management:
   - Primary Key: `NEW_KEY`
   - Previous Key: `OLD_KEY`
3. Execute the migration script using Node.js:
   ```javascript
   const { migrateCredentialsToDedicatedKey } = require("./server/src/livetv/crypto");
   const Database = require("better-sqlite3");
   const db = new Database(process.env.DB_FILE);

   const result = migrateCredentialsToDedicatedKey(db, OLD_KEY, NEW_KEY);
   console.log(`Migrated ${result.migrated} providers to new key (${result.skipped} skipped).`);
   ```
4. Once verified, decommission `OLD_KEY` and retain only `NEW_KEY` as `LIVETV_ENCRYPTION_KEY`.
