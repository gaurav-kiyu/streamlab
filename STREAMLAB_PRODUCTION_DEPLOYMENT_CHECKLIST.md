# STREAMLAB — PRODUCTION DEPLOYMENT CHECKLIST
**Operations, Infrastructure, Reverse Proxy & Maintenance Guide**

* **Document ID:** PDC-PHASE14-STREAMLAB-2026  
* **Release Candidate:** `v1.0.0-rc1`  
* **Date:** November 1, 2026  
* **DevOps Authority:** Principal DevSecOps & Production Reliability Engineer  

---

## 1. Production Pre-Deployment Checklist

Before exposing StreamLab to public traffic, verify and check off each item:

### A. Environment Configuration (`.env`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT=3000` (or custom internal port)
- [ ] Set `JWT_SECRET` to a cryptographically strong 64-character hex string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Set `ADMIN_INITIAL_PASSWORD` to an initial secure passphrase, or let the server generate a one-time secret in `.initial-admin-token`.
- [ ] Set `CORS_ORIGIN` to your explicit frontend domain (e.g. `https://streamlab.yourdomain.com`).
- [ ] Set `TMDB_API_KEY` to your production TMDB API v3 key.
- [ ] Ensure `.env` and `.initial-admin-token` have strict file permissions (`chmod 600 .env`).

### B. HTTPS Reverse Proxy (Nginx Configuration)
StreamLab runs as an internal Node.js service. An external reverse proxy **must** terminate TLS and forward traffic:

```nginx
# /etc/nginx/sites-available/streamlab.conf

server {
    listen 80;
    server_name streamlab.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name streamlab.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/streamlab.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/streamlab.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Upstream timeouts
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }
}
```

---

## 2. Linux Production Host Service Setup (Systemd)

To ensure automatic restarts on failure and system reboots:

```ini
# /etc/systemd/system/streamlab.service

[Unit]
Description=StreamLab Multi-Device Video Streaming Backend
After=network.target

[Service]
Type=simple
User=streamlab
WorkingDirectory=/opt/streamlab/server
EnvironmentFile=/opt/streamlab/server/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=streamlab

# Security hardening
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable streamlab
sudo systemctl start streamlab
```

---

## 3. Automated SQLite Backup & Maintenance Cron

Because SQLite is configured in **WAL (Write-Ahead Logging)** mode, backups can be captured online without taking down the server.

Create a nightly backup script `/opt/streamlab/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/streamlab"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Execute SQLite safe online vacuum backup
sqlite3 /opt/streamlab/server/data.db "VACUUM INTO '$BACKUP_DIR/data_$TIMESTAMP.db';"

# Keep only last 14 days of backups
find "$BACKUP_DIR" -type f -name "data_*.db" -mtime +14 -delete
```

Add to cron (`crontab -e`):
```cron
0 3 * * * /opt/streamlab/backup.sh > /dev/null 2>&1
```

---

## 4. Post-Deployment Verification Steps

1. Visit `https://streamlab.yourdomain.com/api/health` ➔ Confirm HTTP 200 `{ status: "ok" }`.
2. Visit `https://streamlab.yourdomain.com/admin` ➔ Retrieve one-time token from `.initial-admin-token`, log in, and complete the mandatory password change.
3. Verify `.initial-admin-token` is automatically unlinked from disk upon successful password change.
4. Launch the mobile/TV client pointing to `https://streamlab.yourdomain.com`.
