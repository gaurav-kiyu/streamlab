# STREAMLAB — PRODUCTION DEPLOYMENT RUNBOOK & OPERATIONAL GUIDE

**Application:** StreamLab Streaming Platform  
**Target Architecture:** Node.js Backend + React Native Mobile & TV Client  
**Version:** 0.2.0

---

## 1. PREREQUISITES

* **Node.js:** v18.0.0 or higher (v24.x tested and supported)
* **npm:** v9.x or higher (v11.x tested and supported)
* **For Mobile/TV Builds:** Expo CLI (`npx expo`), Android Studio with Android SDK 34+, Xcode 15+ (for iOS/Apple TV)

---

## 2. SERVER DEPLOYMENT STEPS

### Step 1: Clone & Configure Environment
```bash
cd D:\AI_APPs\VIDEO_STREAMING_APP\streamlab-app
copy .env.example .env
```
Edit `.env` to configure production variables:
```ini
PORT=3000
NODE_ENV=production
JWT_SECRET=YOUR_MINIMUM_32_CHAR_RANDOM_SECRET_KEY
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=YourStrongInitialPasswordHere!
TMDB_API_KEY=your_free_tmdb_api_key_here
CORS_ORIGIN=https://admin.yourdomain.com,http://localhost:3000
```

### Step 2: Install Dependencies & Run Tests
```bash
# Install backend dependencies
cd server
npm install

# Run automated verification suite
npm test
```

### Step 3: Start Production Server with PM2
```bash
# Install PM2 process manager globally if needed
npm install -g pm2

# Start StreamLab daemon
pm2 start server.js --name "streamlab-server" --time

# Save PM2 process list for auto-restart on reboot
pm2 save
pm2 startup
```

### Step 4: Verify Admin Console
1. Open your browser and navigate to `http://localhost:3000/admin`.
2. Sign in using your `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD`.
3. The dashboard will prompt you to change your temporary password if `must_change` is active.
4. You can now manage settings, view active users, publish featured streaming rows, and review audit logs.

---

## 3. MOBILE & TV CLIENT BUILD STEPS

### Development Mode (Expo)
```bash
cd mobile
npm install

# Start development bundler
npm run start
```

### Android Mobile Build (APK / AAB)
```bash
cd mobile
npx expo run:android --variant release
```

### Android TV & Fire TV Build
```bash
cd mobile
EXPO_TV=1 npx expo run:android --variant release
```

### iOS & Apple TV Build
```bash
cd mobile
# iOS Mobile
npx expo run:ios --configuration Release

# Apple TV (tvOS)
EXPO_TV=1 npx expo run:ios --configuration Release
```

---

## 4. DATABASE MAINTENANCE & BACKUPS

StreamLab stores account credentials, user profiles, progress, and configuration in SQLite with WAL mode enabled.

### Safe Hot Backup Procedure
SQLite WAL mode allows zero-downtime online backups:
```bash
# Safely snapshot the database while the server is running
sqlite3 data.db ".backup 'backups/streamlab_backup_$(date +%Y%m%d).db'"
```

### Disaster Recovery / Rollback
1. Stop the server: `pm2 stop streamlab-server`
2. Restore the database file: `copy backups\streamlab_backup_YYYYMMDD.db server\data.db`
3. Restart the server: `pm2 start streamlab-server`
