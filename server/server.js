"use strict";
// StreamLab Production-Grade Server
// Multi-device backend: accounts, remote app config, TMDB proxy, and the admin panel (/admin).
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data.db");

// ---- Database Initialization & WAL Mode ----
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE COLLATE NOCASE NOT NULL,
  hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  disabled INTEGER NOT NULL DEFAULT 0,
  must_change INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS featured (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  overview TEXT DEFAULT '',
  poster_url TEXT DEFAULT '',
  stream_url TEXT NOT NULL,
  language TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT 'default',
  is_kids INTEGER NOT NULL DEFAULT 0,
  pin TEXT DEFAULT NULL,
  language TEXT DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  profile_id INTEGER,
  media_id TEXT NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  stream_url TEXT NOT NULL,
  position REAL NOT NULL DEFAULT 0,
  duration REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, profile_id, media_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  profile_id INTEGER,
  media_id TEXT NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  overview TEXT,
  media_type TEXT DEFAULT 'movie',
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, profile_id, media_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// Safe migration for token_version column if existing database is reused
try {
  db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1");
} catch {}

// ---- JWT Secret Handling ----
function resolveSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 32) {
    return process.env.JWT_SECRET.trim();
  }
  if (NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable (min 32 chars) is required in production mode!");
  }
  const row = db.prepare("SELECT value FROM config WHERE key='_jwtSecret'").get();
  if (row) {
    try { return JSON.parse(row.value); } catch {}
  }
  const generated = crypto.randomBytes(48).toString("hex");
  db.prepare("INSERT INTO config(key,value) VALUES('_jwtSecret',?)").run(JSON.stringify(generated));
  return generated;
}
const SECRET = resolveSecret();

// ---- Live TV Subsystem Initialization (Phase 16 & 17) ----
const livetvMigrations = require("./src/livetv/migrations");
livetvMigrations.up(db);

const { resolveLiveTvSecret } = require("./src/livetv/crypto");
const LIVETV_SECRET = resolveLiveTvSecret(SECRET);

const { ChannelRepository, ImportJobManager } = require("./src/livetv/repository");
const { PlaylistProvider, OfficialChannelProvider } = require("./src/livetv/providers");
const { EPGRepository } = require("./src/livetv/epg-repository");
const { parseXmltv } = require("./src/livetv/epg-parser");
const { secureFetch } = require("./src/livetv/ssrf");

const channelRepo = new ChannelRepository(db, LIVETV_SECRET);
const importJobManager = new ImportJobManager(db);
const epgRepo = new EPGRepository(db);

// Clean up any jobs or staging records interrupted by a previous restart
importJobManager.cleanupStaleJobs();
epgRepo.cleanupStaleStaging(1);

// ---- Error and Audit Utilities ----
const err = (msg, status = 400, code) => Object.assign(new Error(msg), { status, code });
const audit = (actor, action, detail = "") => {
  try {
    db.prepare("INSERT INTO audit(actor,action,detail) VALUES(?,?,?)")
      .run(String(actor || "system").slice(0, 50), String(action).slice(0, 50), String(detail).slice(0, 500));
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
};

// ---- App Configuration Schema ----
const SCHEMA = [
  { key: "tmdbKey", group: "Content sources", label: "TMDB API key", type: "text", default: "", isPublic: false, help: "Used for posters and discovery. Kept securely on backend." },
  { key: "jfUrl", group: "Content sources", label: "Jellyfin default server", type: "text", default: "", isPublic: false, help: "Default server for personal libraries." },
  { key: "showArchiveRows", group: "Content sources", label: "Show Internet Archive rows", type: "bool", default: true, isPublic: true },
  { key: "downloadsEnabled", group: "Features", label: "Allow offline downloads", type: "bool", default: true, isPublic: true },
  { key: "signupEnabled", group: "Accounts", label: "Allow new sign-ups", type: "bool", default: true, isPublic: true },
  { key: "guestBrowsingEnabled", group: "Accounts", label: "Allow browsing without an account", type: "bool", default: true, isPublic: true, help: "Turn off to require login before using the app." },
  { key: "defaultQuality", group: "Playback defaults", label: "Default stream quality", type: "select", options: ["auto", "480", "720", "1080", "1440", "2160"], default: "auto", isPublic: true },
  { key: "dataSaverDefault", group: "Playback defaults", label: "Data saver on by default", type: "bool", default: false, isPublic: true },
  { key: "announcement", group: "Messages", label: "Announcement banner", type: "text", default: "", isPublic: true, help: "Shown at top of Browse. Leave empty to hide." },
  { key: "maintenanceMode", group: "Messages", label: "Maintenance mode", type: "bool", default: false, isPublic: true, help: "Blocks mobile app for non-admins." },
  { key: "maintenanceMessage", group: "Messages", label: "Maintenance message", type: "text", default: "StreamLab is undergoing scheduled maintenance.", isPublic: true },
];

function getAllConfig() {
  const out = {};
  for (const f of SCHEMA) out[f.key] = f.default;
  for (const r of db.prepare("SELECT key,value FROM config").all()) {
    if (r.key in out) {
      try { out[r.key] = JSON.parse(r.value); } catch {}
    }
  }
  if (process.env.TMDB_API_KEY && !out.tmdbKey) {
    out.tmdbKey = process.env.TMDB_API_KEY.trim();
  }
  return out;
}

function getPublicConfig() {
  const all = getAllConfig();
  const safe = {};
  for (const f of SCHEMA) {
    if (f.isPublic) {
      safe[f.key] = all[f.key];
    }
  }
  return safe;
}

function cleanConfig(patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    const f = SCHEMA.find((x) => x.key === k);
    if (!f) throw err(`Unknown setting: ${k}`);
    if (f.type === "bool") {
      if (typeof v !== "boolean") throw err(`${f.label} must be on or off`);
      clean[k] = v;
    } else if (f.type === "select") {
      if (!f.options.includes(v)) throw err(`${f.label}: invalid choice`);
      clean[k] = v;
    } else {
      if (typeof v !== "string" || v.length > 500) throw err(`${f.label} must be text under 500 characters`);
      if (k === "jfUrl" && v.trim() && !/^https?:\/\//i.test(v.trim())) throw err("Jellyfin address must start with http:// or https://");
      clean[k] = v.trim();
    }
  }
  return clean;
}

// ---- Bounded In-Memory Rate Limiter ----
const rateLimitMap = new Map();
const MAX_RATE_LIMIT_KEYS = 5000;

function checkRateLimit(key, maxAttempts, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  let record = rateLimitMap.get(key);
  if (!record || record.reset < now) {
    if (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [k, rec] of rateLimitMap) {
        if (rec.reset < now) rateLimitMap.delete(k);
      }
      if (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = rateLimitMap.keys().next().value;
        rateLimitMap.delete(oldestKey);
      }
    }
    record = { count: 0, reset: now + windowMs };
    rateLimitMap.set(key, record);
  }
  record.count++;
  if (record.count > maxAttempts) {
    const retrySec = Math.ceil((record.reset - now) / 1000);
    throw err(`Too many attempts. Please try again in ${retrySec} seconds.`, 429, "RATE_LIMIT_EXCEEDED");
  }
}
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of rateLimitMap) {
    if (rec.reset < now) rateLimitMap.delete(k);
  }
}, 60000).unref();

// ---- Auth Helpers ----
const DUMMY_HASH = bcrypt.hashSync("streamlab-dummy-salt-password", 10);
const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  role: u.role,
  mustChange: !!u.must_change,
  createdAt: u.created_at,
  lastLogin: u.last_login
});

const sign = (u) => jwt.sign(
  { sub: u.id, role: u.role, username: u.username, tv: u.token_version || 1 },
  SECRET,
  { expiresIn: u.role === "admin" ? "12h" : "30d" }
);

const checkPassword = (p) => {
  if (typeof p !== "string" || p.length < 8) throw err("Password must be at least 8 characters");
  if (p.length > 72) throw err("Password must be 72 characters or fewer");
};

function auth(req, res, next) {
  const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: "Please log in to continue", code: "AUTH_REQUIRED" });
  try {
    const payload = jwt.verify(m[1], SECRET);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(payload.sub);
    if (!user || user.disabled) {
      return res.status(401).json({ error: "Account is disabled or unavailable", code: "ACCOUNT_DISABLED" });
    }
    // Verify token has not been revoked via logout or password rotation
    if (payload.tv && user.token_version && payload.tv !== user.token_version) {
      return res.status(401).json({ error: "Session has been revoked. Please log in again.", code: "SESSION_REVOKED" });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again.", code: "SESSION_EXPIRED" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Administrator privileges required", code: "ADMIN_REQUIRED" });
  }
  if (req.user.must_change) {
    return res.status(403).json({ error: "You must change the default password first", code: "MUST_CHANGE_PASSWORD" });
  }
  next();
}

function validateUserProfile(userId, profileId) {
  if (!profileId) return null;
  const p = db.prepare("SELECT id, is_kids FROM profiles WHERE id=? AND user_id=?").get(profileId, userId);
  if (!p) throw err("Specified profile does not belong to your account", 403, "INVALID_PROFILE");
  return p;
}

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    const status = e.status || 400;
    const response = { error: e.message || "An error occurred", code: e.code };
    if (NODE_ENV !== "production" && e.stack && status >= 500) {
      response.debug = e.stack;
    }
    res.status(status).json(response);
  }
};

const activeAdmins = (exceptId = 0) =>
  db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND disabled=0 AND id<>?").get(exceptId).c;

// ---- Seed Initial Administrator Safely ----
const existingAdmin = db.prepare("SELECT id, username FROM users WHERE role='admin'").get();
if (!existingAdmin) {
  const adminUsername = (process.env.ADMIN_INITIAL_USERNAME || "admin").trim();
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD
    ? process.env.ADMIN_INITIAL_PASSWORD.trim()
    : crypto.randomBytes(9).toString("base64url") + "!1A";
  
  db.prepare("INSERT INTO users(username,hash,role,must_change) VALUES(?,?,'admin',1)")
    .run(adminUsername, bcrypt.hashSync(initialPassword, 10));
  
  audit("system", "seed", `Initial admin '${adminUsername}' created`);
  console.log("================================================================================");
  console.log(`[StreamLab Security] Initial administrator account created for: '${adminUsername}'`);
  if (process.env.ADMIN_INITIAL_PASSWORD) {
    console.log(`  Password: [Configured via ADMIN_INITIAL_PASSWORD environment variable]`);
  } else {
    const setupFilePath = path.join(__dirname, ".initial-admin-token");
    try { fs.writeFileSync(setupFilePath, initialPassword, { mode: 0o600 }); } catch {}
    console.log(`  One-time temporary credential securely written to: ${setupFilePath}`);
  }
  console.log(`  IMPORTANT: You MUST change this temporary password at first login via /admin`);
  console.log("================================================================================");
}

// ---- Express Server Configuration ----
const app = express();
app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:3000", "http://localhost:8081", "http://127.0.0.1:3000"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: "150kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
  next();
});

// Serve Admin Dashboard
app.use("/public", express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.redirect("/admin"));
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Health check with memory and database diagnostics (REQ-18-05)
app.get("/api/health", (req, res) => {
  const mem = process.memoryUsage();
  let dbStats = { ok: true };
  try {
    const pageCountRow = db.prepare("PRAGMA page_count").get();
    const pageSizeRow = db.prepare("PRAGMA page_size").get();
    const pages = pageCountRow?.page_count || 0;
    const pageSize = pageSizeRow?.page_size || 4096;
    dbStats = {
      pages,
      pageSize,
      sizeKb: Math.round((pages * pageSize) / 1024),
      walMode: true
    };
  } catch (e) {
    dbStats = { ok: false, error: e.message };
  }

  res.json({
    ok: true,
    version: "1.2.0",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
    },
    database: dbStats
  });
});

// Public Mobile / TV Config Endpoint
app.get("/api/config", (req, res) => {
  const publicConfig = getPublicConfig();
  const featured = db.prepare(
    "SELECT id,title,overview,poster_url,stream_url,language,sort FROM featured WHERE enabled=1 ORDER BY sort, id"
  ).all();
  res.json({ ...publicConfig, featured });
});

// ---- Authentication Routes ----
app.post("/api/auth/login", wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    throw err("Username and password are required", 400);
  }
  const cleanUsername = username.trim();
  const clientKey = `login|${req.ip}|${cleanUsername.toLowerCase()}`;
  checkRateLimit(clientKey, 8, 10 * 60 * 1000);

  const user = db.prepare("SELECT * FROM users WHERE username=?").get(cleanUsername);
  const passwordMatch = bcrypt.compareSync(password, user ? user.hash : DUMMY_HASH) && !!user;
  
  if (!passwordMatch) {
    throw err("Invalid username or password", 401, "INVALID_CREDENTIALS");
  }
  if (user.disabled) {
    throw err("This account has been disabled. Please contact the administrator.", 403, "ACCOUNT_DISABLED");
  }

  rateLimitMap.delete(clientKey);
  db.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").run(user.id);
  audit(user.username, "login", `Client: ${req.headers["user-agent"] || "unknown"}`);

  res.json({
    token: sign(user),
    user: publicUser(user)
  });
}));

app.post("/api/auth/signup", wrap(async (req, res) => {
  const config = getAllConfig();
  if (!config.signupEnabled) {
    throw err("Account registration is currently closed by the administrator", 403, "SIGNUP_CLOSED");
  }
  checkRateLimit(`signup|${req.ip}`, 5, 15 * 60 * 1000);

  const { username, password } = req.body || {};
  if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
    throw err("Username must be 3 to 30 characters containing letters, numbers, dots, dashes or underscores", 400);
  }
  const cleanUsername = username.trim();
  checkPassword(password);

  const existing = db.prepare("SELECT 1 FROM users WHERE username=?").get(cleanUsername);
  if (existing) {
    throw err("That username is already taken", 409, "USERNAME_TAKEN");
  }

  const hash = bcrypt.hashSync(password, 10);
  const insert = db.prepare("INSERT INTO users(username,hash,role) VALUES(?,?,'user')").run(cleanUsername, hash);
  const newUser = db.prepare("SELECT * FROM users WHERE id=?").get(insert.lastInsertRowid);
  
  db.prepare("INSERT INTO profiles(user_id,name) VALUES(?,?)").run(newUser.id, cleanUsername);
  
  audit(newUser.username, "signup");
  res.status(201).json({
    token: sign(newUser),
    user: publicUser(newUser)
  });
}));

app.get("/api/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", auth, wrap(async (req, res) => {
  db.prepare("UPDATE users SET token_version = token_version + 1 WHERE id=?").run(req.user.id);
  audit(req.user.username, "logout", "All sessions invalidated");
  res.json({ ok: true, message: "Logged out successfully" });
}));

app.post("/api/auth/change-password", auth, wrap(async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(String(oldPassword || ""), req.user.hash)) {
    throw err("Current password is incorrect", 401, "INCORRECT_OLD_PASSWORD");
  }
  checkPassword(newPassword);
  if (oldPassword === newPassword) {
    throw err("New password must be different from current password", 400);
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET hash=?, must_change=0, token_version = token_version + 1 WHERE id=?")
    .run(newHash, req.user.id);
  
  if (req.user.role === "admin") {
    try {
      const tokenPath = path.join(__dirname, ".initial-admin-token");
      if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    } catch {}
  }

  audit(req.user.username, "password changed");
  res.json({ ok: true, message: "Password updated successfully" });
}));

// ---- User Profile & Multi-Profile Routes ----
app.get("/api/profiles", auth, (req, res) => {
  const profiles = db.prepare("SELECT id, user_id, name, avatar, is_kids, (pin IS NOT NULL) AS has_pin, language, created_at FROM profiles WHERE user_id=? ORDER BY id").all(req.user.id);
  res.json({ profiles });
});

app.post("/api/profiles", auth, wrap(async (req, res) => {
  const { name, isKids, pin, language } = req.body || {};
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 30) throw err("Profile name must be 1 to 30 characters");
  
  const currentCount = db.prepare("SELECT COUNT(*) c FROM profiles WHERE user_id=?").get(req.user.id).c;
  if (currentCount >= 5) throw err("Maximum of 5 profiles per account reached", 400);

  let pinHash = null;
  if (pin) {
    if (!/^\d{4}$/.test(String(pin))) throw err("Parental PIN must be exactly 4 digits", 400);
    pinHash = bcrypt.hashSync(String(pin), 8);
  }

  const result = db.prepare(
    "INSERT INTO profiles(user_id, name, is_kids, pin, language) VALUES(?,?,?,?,?)"
  ).run(req.user.id, cleanName, isKids ? 1 : 0, pinHash, language || "en");

  audit(req.user.username, "profile created", cleanName);
  res.status(201).json({ id: result.lastInsertRowid, name: cleanName, isKids: !!isKids, has_pin: !!pinHash });
}));

app.post("/api/profiles/:id/verify-pin", auth, wrap(async (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!profile) throw err("Profile not found", 404, "PROFILE_NOT_FOUND");
  if (!profile.pin) return res.json({ ok: true, pinRequired: false, verified: true });

  const clientKey = `pin|${req.user.id}|${profile.id}`;
  checkRateLimit(clientKey, 4, 5 * 60 * 1000);

  const { pin } = req.body || {};
  if (!pin || typeof pin !== "string") throw err("Parental PIN is required", 400, "PIN_REQUIRED");

  const match = bcrypt.compareSync(String(pin), profile.pin);
  if (!match) throw err("Incorrect Parental PIN", 401, "INCORRECT_PIN");

  rateLimitMap.delete(clientKey);
  res.json({ ok: true, verified: true });
}));

app.delete("/api/profiles/:id", auth, wrap(async (req, res) => {
  const profile = db.prepare("SELECT * FROM profiles WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!profile) throw err("Profile not found", 404);
  const totalProfiles = db.prepare("SELECT COUNT(*) c FROM profiles WHERE user_id=?").get(req.user.id).c;
  if (totalProfiles <= 1) throw err("You must retain at least one profile", 400);

  db.prepare("DELETE FROM profiles WHERE id=?").run(profile.id);
  audit(req.user.username, "profile deleted", profile.name);
  res.json({ ok: true });
}));

// ---- Strict Cloud Sync with Profile Isolation ----
app.get("/api/sync/progress", auth, wrap(async (req, res) => {
  const profileId = req.query.profileId ? Number(req.query.profileId) : null;
  if (profileId) validateUserProfile(req.user.id, profileId);

  const query = profileId
    ? "SELECT media_id, title, poster_path, stream_url, position, duration, updated_at FROM user_progress WHERE user_id=? AND profile_id=? ORDER BY updated_at DESC LIMIT 20"
    : "SELECT media_id, title, poster_path, stream_url, position, duration, updated_at FROM user_progress WHERE user_id=? AND profile_id IS NULL ORDER BY updated_at DESC LIMIT 20";

  const list = db.prepare(query).all(profileId ? [req.user.id, profileId] : [req.user.id]);
  res.json({ progress: list });
}));

app.post("/api/sync/progress", auth, wrap(async (req, res) => {
  const { profileId, mediaId, title, posterPath, streamUrl, position, duration } = req.body || {};
  if (!mediaId || !streamUrl) throw err("mediaId and streamUrl are required");
  if (profileId) validateUserProfile(req.user.id, Number(profileId));
  
  db.prepare(`
    INSERT INTO user_progress(user_id, profile_id, media_id, title, poster_path, stream_url, position, duration, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, profile_id, media_id) DO UPDATE SET
      position=excluded.position,
      duration=excluded.duration,
      updated_at=datetime('now')
  `).run(req.user.id, profileId ? Number(profileId) : null, String(mediaId), String(title || ""), posterPath || null, String(streamUrl), Number(position) || 0, Number(duration) || 0);

  res.json({ ok: true });
}));

app.get("/api/sync/watchlist", auth, wrap(async (req, res) => {
  const profileId = req.query.profileId ? Number(req.query.profileId) : null;
  if (profileId) validateUserProfile(req.user.id, profileId);

  const query = profileId
    ? "SELECT media_id, title, poster_path, overview, media_type, added_at FROM user_watchlist WHERE user_id=? AND profile_id=? ORDER BY added_at DESC"
    : "SELECT media_id, title, poster_path, overview, media_type, added_at FROM user_watchlist WHERE user_id=? AND profile_id IS NULL ORDER BY added_at DESC";

  const list = db.prepare(query).all(profileId ? [req.user.id, profileId] : [req.user.id]);
  res.json({ watchlist: list });
}));

app.post("/api/sync/watchlist/toggle", auth, wrap(async (req, res) => {
  const { profileId, item } = req.body || {};
  if (!item || !item.id) throw err("Item with valid ID is required");
  if (profileId) validateUserProfile(req.user.id, Number(profileId));
  const mediaId = String(item.id);

  const existing = profileId
    ? db.prepare("SELECT id FROM user_watchlist WHERE user_id=? AND profile_id=? AND media_id=?").get(req.user.id, Number(profileId), mediaId)
    : db.prepare("SELECT id FROM user_watchlist WHERE user_id=? AND profile_id IS NULL AND media_id=?").get(req.user.id, mediaId);

  if (existing) {
    db.prepare("DELETE FROM user_watchlist WHERE id=?").run(existing.id);
    return res.json({ inList: false });
  } else {
    db.prepare(
      "INSERT INTO user_watchlist(user_id, profile_id, media_id, title, poster_path, overview, media_type) VALUES(?,?,?,?,?,?,?)"
    ).run(req.user.id, profileId ? Number(profileId) : null, mediaId, String(item.title || ""), item.poster_path || null, item.overview || null, item.media || "movie");
    return res.json({ inList: true });
  }
}));

// ---- TMDB Secure Proxy (With Timeout & Kids Filter) ----
app.get("/api/tmdb/discover", wrap(async (req, res) => {
  const config = getAllConfig();
  const apiKey = config.tmdbKey;
  if (!apiKey) {
    return res.status(503).json({ error: "TMDB API key not configured on server", code: "TMDB_NOT_CONFIGURED" });
  }
  const type = req.query.type === "tv" ? "tv" : "movie";
  const params = new URLSearchParams(req.query);
  params.delete("type");
  params.set("api_key", apiKey);

  if (req.query.kids === "true") {
    params.set("include_adult", "false");
    params.set("with_genres", "10751,16");
  }

  try {
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/discover/${type}?${params.toString()}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (!tmdbRes.ok) throw err(`TMDB returned ${tmdbRes.status}`, 502, "UPSTREAM_ERROR");
    const data = await tmdbRes.json();
    res.json(data);
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw err("Upstream TMDB request timed out", 504, "UPSTREAM_TIMEOUT");
    }
    throw e;
  }
}));

app.get("/api/tmdb/search", wrap(async (req, res) => {
  const config = getAllConfig();
  const apiKey = config.tmdbKey;
  const q = String(req.query.query || "").trim();
  if (!q) return res.json({ results: [] });
  if (!apiKey) {
    return res.status(503).json({ error: "TMDB API key not configured on server", code: "TMDB_NOT_CONFIGURED" });
  }

  try {
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&region=IN&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!tmdbRes.ok) throw err(`TMDB returned ${tmdbRes.status}`, 502, "UPSTREAM_ERROR");
    const data = await tmdbRes.json();
    res.json(data);
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw err("Upstream TMDB request timed out", 504, "UPSTREAM_TIMEOUT");
    }
    throw e;
  }
}));

// ---- Live TV Core API (Phase 16) ----
app.get("/api/livetv/providers", auth, wrap(async (req, res) => {
  const profileId = req.query.profileId ? Number(req.query.profileId) : null;
  if (profileId) validateUserProfile(req.user.id, profileId);
  const providers = channelRepo.getProviders(req.user.id, profileId);
  res.json({ providers });
}));

app.post("/api/livetv/providers", auth, wrap(async (req, res) => {
  const { name, type, url, profileId, epgUrl, rightsAcknowledged } = req.body || {};
  if (!name || typeof name !== "string") {
    throw err("Provider name is required", 400);
  }
  if (!rightsAcknowledged) {
    throw err("You must acknowledge that you hold the lawful rights to access imported streams", 400, "RIGHTS_ACKNOWLEDGEMENT_REQUIRED");
  }
  if (type !== "playlist" && type !== "official" && type !== "jellyfin") {
    throw err("Invalid provider type", 400);
  }

  const pId = profileId ? Number(profileId) : null;
  if (pId) validateUserProfile(req.user.id, pId);

  const provider = channelRepo.createProvider(req.user.id, pId, {
    name: name.trim(),
    type,
    url: url ? String(url).trim() : null,
    epgUrl: epgUrl ? String(epgUrl).trim() : null
  });

  audit(req.user.username, "livetv_provider_created", `Provider: ${provider.name} (${provider.type})`);
  res.status(201).json({ provider });
}));

app.delete("/api/livetv/providers/:id", auth, wrap(async (req, res) => {
  const deleted = channelRepo.removeProvider(req.user.id, req.params.id);
  if (!deleted) throw err("Provider not found or unauthorized", 404);
  audit(req.user.username, "livetv_provider_deleted", `Provider ID: ${req.params.id}`);
  res.json({ ok: true });
}));

app.post("/api/livetv/import", auth, wrap(async (req, res) => {
  const { providerId, profileId, url, content, rightsAcknowledged } = req.body || {};
  if (!providerId) throw err("Provider ID is required", 400);
  if (!rightsAcknowledged) {
    throw err("You must acknowledge that you hold the lawful rights to access imported streams", 400, "RIGHTS_ACKNOWLEDGEMENT_REQUIRED");
  }
  const pId = profileId ? Number(profileId) : null;
  if (pId) validateUserProfile(req.user.id, pId);

  const provider = channelRepo.getProviderById(req.user.id, providerId);
  if (!provider) throw err("Provider not found or unauthorized", 404);

  // Acquire persistent job lock
  const lock = importJobManager.acquireLock(req.user.id, providerId, "playlist_import", 60);
  if (!lock.locked) {
    return res.status(429).json({
      error: "An import job is already running for this account. Please wait.",
      code: "IMPORT_IN_PROGRESS",
      activeJob: lock.activeJob
    });
  }

  const jobId = lock.jobId;

  try {
    let parsed;
    if (provider.type === "official") {
      const official = new OfficialChannelProvider();
      const chs = await official.getChannels();
      parsed = { channels: chs, totalFound: chs.length, truncated: false, epgUrl: null };
    } else {
      const playlist = new PlaylistProvider({
        id: providerId,
        playlistUrl: url || provider.url,
        rawContent: content
      });
      parsed = await playlist.fetchAndParse({ maxChannels: 2000 });
    }

    const count = channelRepo.saveChannels(req.user.id, pId, providerId, parsed.channels);

    importJobManager.releaseLock(jobId, "completed", {
      channelsFound: parsed.totalFound,
      channelsImported: count
    });

    audit(req.user.username, "livetv_channels_imported", `Provider ${providerId}: ${count} channels imported`);
    res.json({
      ok: true,
      jobId,
      channelsImported: count,
      totalFound: parsed.totalFound,
      truncated: parsed.truncated,
      epgUrl: parsed.epgUrl
    });
  } catch (e) {
    importJobManager.releaseLock(jobId, "failed", { errorMessage: e.message });
    throw e;
  }
}));

app.get("/api/livetv/channels", auth, wrap(async (req, res) => {
  const profileId = req.query.profileId ? Number(req.query.profileId) : null;
  if (profileId) validateUserProfile(req.user.id, profileId);

  const channels = channelRepo.getChannels(req.user.id, profileId, {
    category: req.query.category,
    search: req.query.search,
    favoritesOnly: req.query.favoritesOnly === "true"
  });

  res.json({ channels });
}));

app.post("/api/livetv/channels/:id/favorite", auth, wrap(async (req, res) => {
  const profileId = Number(req.body.profileId || req.query.profileId);
  if (!profileId) throw err("Profile ID is required", 400);
  validateUserProfile(req.user.id, profileId);

  const result = channelRepo.toggleFavorite(req.user.id, profileId, req.params.id);
  res.json(result);
}));

app.post("/api/livetv/channels/:id/history", auth, wrap(async (req, res) => {
  const profileId = Number(req.body.profileId || req.query.profileId);
  if (!profileId) throw err("Profile ID is required", 400);
  validateUserProfile(req.user.id, profileId);

  channelRepo.recordHistory(req.user.id, profileId, req.params.id, Number(req.body.duration || 0));
  res.json({ ok: true });
}));

app.get("/api/livetv/recent", auth, wrap(async (req, res) => {
  const profileId = Number(req.query.profileId);
  if (!profileId) throw err("Profile ID is required", 400);
  validateUserProfile(req.user.id, profileId);

  const recent = channelRepo.getRecent(req.user.id, profileId, Number(req.query.limit || 10));
  res.json({ recent });
}));

// ---- Live TV EPG Subsystem API (Phase 17) ----
app.get("/api/livetv/epg/channels/:channelId/current", auth, wrap(async (req, res) => {
  const info = epgRepo.getCurrentAndNext(req.params.channelId, req.query.nowUtc || null);
  res.json(info);
}));

app.get("/api/livetv/epg/channels/:channelId/schedule", auth, wrap(async (req, res) => {
  const now = new Date();
  const startUtc = req.query.startUtc || new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
  const endUtc = req.query.endUtc || new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const schedule = epgRepo.getChannelSchedule(req.params.channelId, startUtc, endUtc);
  res.json({ channelId: req.params.channelId, schedule });
}));

app.get("/api/livetv/epg/guide", auth, wrap(async (req, res) => {
  const profileId = req.query.profileId ? Number(req.query.profileId) : null;
  if (profileId) validateUserProfile(req.user.id, profileId);

  const now = new Date();
  const startUtc = req.query.startUtc || new Date(now.getTime() - 1 * 3600 * 1000).toISOString();
  const endUtc = req.query.endUtc || new Date(now.getTime() + 12 * 3600 * 1000).toISOString();

  const guide = epgRepo.getMultiChannelGuide(req.user.id, profileId, startUtc, endUtc);
  res.json(guide);
}));

app.post("/api/livetv/epg/import", auth, wrap(async (req, res) => {
  const { providerId, profileId, epgUrl, content, rightsAcknowledged } = req.body || {};
  if (!rightsAcknowledged) {
    const e = err("Rights acknowledgement required to import EPG data", 400);
    e.code = "RIGHTS_ACKNOWLEDGEMENT_REQUIRED";
    throw e;
  }
  const pId = profileId ? Number(profileId) : null;
  if (pId) validateUserProfile(req.user.id, pId);

  let provider = null;
  if (providerId) {
    provider = channelRepo.getProviderById(req.user.id, providerId);
    if (!provider) throw err("Provider not found or unauthorized", 404);
  }

  const targetUrl = epgUrl || (provider ? provider.epg_url : null);
  if (!targetUrl && !content) {
    throw err("EPG URL or raw XML content is required", 400);
  }

  // Acquire job lock
  const lock = importJobManager.acquireLock(req.user.id, providerId || null, "epg_sync", 120);
  if (!lock.locked) {
    return res.status(429).json({
      error: "An EPG sync job is already in progress for this account.",
      code: "IMPORT_IN_PROGRESS",
      activeJob: lock.activeJob
    });
  }

  const jobId = lock.jobId;

  try {
    let xmlText = content;
    if (!xmlText && targetUrl) {
      const fetchRes = await secureFetch(targetUrl, {
        maxBytes: 25 * 1024 * 1024, // 25 MB
        timeoutMs: 15000
      });
      xmlText = fetchRes.body;
    }

    const parsed = parseXmltv(xmlText, { maxPrograms: 50000 });

    // Stage 1: Write to staging table
    epgRepo.stagePrograms(jobId, parsed.programs);

    // Stage 2: Atomic commit/swap into production epg_programs
    const { committed, unmapped } = epgRepo.commitStagedPrograms(jobId, providerId, req.user.id);

    importJobManager.releaseLock(jobId, "completed", {
      channelsFound: parsed.channels.length,
      channelsImported: committed
    });

    audit(req.user.username, "epg_imported", `${committed} programmes committed (${unmapped} unmapped)`);
    res.json({
      ok: true,
      success: true,
      jobId,
      programsImported: committed,
      channelsMatched: committed > 0 ? (providerId ? 1 : Math.min(committed, parsed.channels.length || 1)) : 0,
      programsCommitted: committed,
      programsUnmapped: unmapped,
      channelsInEpg: parsed.channels.length
    });
  } catch (e) {
    epgRepo.discardStagedPrograms(jobId);
    importJobManager.releaseLock(jobId, "failed", { errorMessage: e.message });
    throw e;
  }
}));

app.get("/api/livetv/epg/jobs/:jobId", auth, wrap(async (req, res) => {
  const job = db.prepare(`
    SELECT job_id, user_id, provider_id, job_type, status, channels_found, channels_imported, started_at, completed_at, error_message
    FROM epg_sync_jobs
    WHERE job_id=? AND user_id=?
  `).get(req.params.jobId, req.user.id);
  if (!job) throw err("Job not found", 404);
  res.json({ job });
}));

// ---- Admin API (Strict Server-Side Authorization) ----
const admin = express.Router();
admin.use(auth, adminOnly);

admin.get("/config", (req, res) => {
  res.json({ schema: SCHEMA, values: getAllConfig() });
});

admin.put("/config", wrap(async (req, res) => {
  const clean = cleanConfig(req.body);
  const updateStmt = db.prepare("INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.transaction(() => {
    for (const [k, v] of Object.entries(clean)) {
      updateStmt.run(k, JSON.stringify(v));
    }
  })();
  audit(req.user.username, "settings updated", Object.keys(clean).join(", "));
  res.json({ values: getAllConfig() });
}));

admin.get("/stats", (req, res) => {
  const count = (sql) => db.prepare(sql).get().c;
  res.json({
    users: count("SELECT COUNT(*) c FROM users"),
    admins: count("SELECT COUNT(*) c FROM users WHERE role='admin'"),
    disabled: count("SELECT COUNT(*) c FROM users WHERE disabled=1"),
    signupsWeek: count("SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','-7 days')"),
    activeDay: count("SELECT COUNT(*) c FROM users WHERE last_login >= datetime('now','-1 day')"),
    featured: count("SELECT COUNT(*) c FROM featured WHERE enabled=1"),
    auditLogs: count("SELECT COUNT(*) c FROM audit")
  });
});

admin.get("/users", (req, res) => {
  res.json(db.prepare("SELECT id,username,role,disabled,must_change,created_at,last_login FROM users ORDER BY id").all());
});

admin.patch("/users/:id", wrap(async (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!target) throw err("User not found", 404);
  
  const { role, disabled } = req.body || {};
  const newRole = role === undefined ? target.role : role;
  const newDisabled = disabled === undefined ? target.disabled : disabled ? 1 : 0;
  
  if (!["user", "admin"].includes(newRole)) throw err("Role must be 'user' or 'admin'");
  if ((newRole !== "admin" || newDisabled) && target.role === "admin" && !activeAdmins(target.id)) {
    throw err("Cannot deactivate the sole remaining active administrator", 400);
  }

  db.prepare("UPDATE users SET role=?, disabled=? WHERE id=?").run(newRole, newDisabled, target.id);
  audit(req.user.username, "user updated", `${target.username}: role=${newRole}, disabled=${newDisabled}`);
  res.json({ ok: true });
}));

admin.post("/users/:id/reset-password", wrap(async (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!target) throw err("User not found", 404);
  
  const { newPassword } = req.body || {};
  checkPassword(newPassword);
  
  db.prepare("UPDATE users SET hash=?, must_change=?, token_version = token_version + 1 WHERE id=?")
    .run(bcrypt.hashSync(newPassword, 10), target.role === "admin" ? 1 : 0, target.id);
  
  audit(req.user.username, "password reset", target.username);
  res.json({ ok: true });
}));

admin.delete("/users/:id", wrap(async (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!target) throw err("User not found", 404);
  if (target.id === req.user.id) throw err("You cannot delete your own account", 400);
  if (target.role === "admin" && !activeAdmins(target.id)) {
    throw err("Cannot delete the sole active administrator", 400);
  }

  db.prepare("DELETE FROM users WHERE id=?").run(target.id);
  audit(req.user.username, "user deleted", target.username);
  res.json({ ok: true });
}));

function validateFeatured(body = {}) {
  const title = String(body.title || "").trim();
  if (!title) throw err("Title is required");
  const streamUrl = String(body.stream_url || "").trim();
  if (!/^https?:\/\//i.test(streamUrl)) throw err("Stream URL must begin with http:// or https://");
  const posterUrl = String(body.poster_url || "").trim();
  if (posterUrl && !/^https?:\/\//i.test(posterUrl)) throw err("Poster URL must begin with http:// or https://");

  return {
    title: title.slice(0, 200),
    overview: String(body.overview || "").slice(0, 1000),
    poster_url: posterUrl,
    stream_url: streamUrl,
    language: String(body.language || "").slice(0, 20),
    enabled: body.enabled === false ? 0 : 1,
    sort: Number.isFinite(+body.sort) ? Math.trunc(+body.sort) : 0
  };
}

admin.get("/featured", (req, res) => {
  res.json(db.prepare("SELECT * FROM featured ORDER BY sort, id").all());
});

admin.post("/featured", wrap(async (req, res) => {
  const f = validateFeatured(req.body);
  const result = db.prepare(
    "INSERT INTO featured(title,overview,poster_url,stream_url,language,enabled,sort) VALUES(@title,@overview,@poster_url,@stream_url,@language,@enabled,@sort)"
  ).run(f);
  audit(req.user.username, "featured added", f.title);
  res.status(201).json({ id: result.lastInsertRowid });
}));

admin.put("/featured/:id", wrap(async (req, res) => {
  const f = validateFeatured(req.body);
  const result = db.prepare(
    "UPDATE featured SET title=@title,overview=@overview,poster_url=@poster_url,stream_url=@stream_url,language=@language,enabled=@enabled,sort=@sort WHERE id=@id"
  ).run({ ...f, id: req.params.id });
  if (!result.changes) throw err("Featured item not found", 404);
  audit(req.user.username, "featured updated", f.title);
  res.json({ ok: true });
}));

admin.delete("/featured/:id", wrap(async (req, res) => {
  const result = db.prepare("DELETE FROM featured WHERE id=?").run(req.params.id);
  if (!result.changes) throw err("Featured item not found", 404);
  audit(req.user.username, "featured deleted", req.params.id);
  res.json({ ok: true });
}));

admin.get("/audit", (req, res) => {
  res.json(db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 150").all());
});

app.use("/api/admin", admin);
app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found", code: "NOT_FOUND" }));

module.exports = { app, db };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StreamLab server online at http://localhost:${PORT}`);
    console.log(`Administration Console available at http://localhost:${PORT}/admin`);
  });
}
