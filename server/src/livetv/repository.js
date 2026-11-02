"use strict";

const crypto = require("crypto");
const { encryptCredentials, decryptCredentials, redactUrl } = require("./crypto");

class ChannelRepository {
  /**
   * @param {import("better-sqlite3").Database} db 
   * @param {string} masterSecret 
   */
  constructor(db, masterSecret) {
    this.db = db;
    this.masterSecret = masterSecret;
  }

  createProvider(userId, profileId, { name, type, url, credentials = null, epgUrl = null }) {
    const id = `prv_${crypto.randomBytes(8).toString("hex")}`;
    const encryptedCreds = credentials ? encryptCredentials(credentials, this.masterSecret) : null;
    const safeUrl = redactUrl(url);

    this.db.prepare(`
      INSERT INTO live_tv_providers (id, user_id, profile_id, type, name, url, encrypted_credentials, epg_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, profileId, type, name, safeUrl, encryptedCreds, epgUrl);

    return this.getProviderById(userId, id);
  }

  getProviderById(userId, providerId) {
    return this.db.prepare(`
      SELECT id, user_id, profile_id, type, name, url, epg_url, enabled, created_at
      FROM live_tv_providers
      WHERE id=? AND user_id=?
    `).get(providerId, userId);
  }

  getProviders(userId, profileId) {
    return this.db.prepare(`
      SELECT id, user_id, profile_id, type, name, url, epg_url, enabled, created_at
      FROM live_tv_providers
      WHERE user_id=? AND (profile_id=? OR profile_id IS NULL)
      ORDER BY created_at DESC
    `).all(userId, profileId);
  }

  removeProvider(userId, providerId) {
    const res = this.db.prepare(`
      DELETE FROM live_tv_providers
      WHERE id=? AND user_id=?
    `).run(providerId, userId);
    return res.changes > 0;
  }

  saveChannels(userId, profileId, providerId, channels) {
    const insertTx = this.db.transaction(() => {
      // Clear previous channels for this provider
      this.db.prepare("DELETE FROM live_tv_channels WHERE provider_id=? AND user_id=?").run(providerId, userId);

      const insertStmt = this.db.prepare(`
        INSERT INTO live_tv_channels (id, provider_id, user_id, profile_id, channel_number, name, logo_url, category, stream_url, tvg_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < channels.length; i++) {
        const ch = channels[i];
        const channelId = `ch_${providerId}_${i + 1}`;
        insertStmt.run(
          channelId,
          providerId,
          userId,
          profileId,
          ch.channelNumber || (i + 1),
          ch.name,
          ch.logo || "",
          ch.category || "General",
          ch.streamUrl,
          ch.tvgId || ""
        );
      }
    });

    insertTx();
    return channels.length;
  }

  getChannels(userId, profileId, options = {}) {
    const { category, search, favoritesOnly } = options;
    let query = `
      SELECT 
        c.id, c.provider_id, c.channel_number, c.name, c.logo_url, c.category, c.stream_url, c.tvg_id,
        (f.id IS NOT NULL) AS is_favorite
      FROM live_tv_channels c
      LEFT JOIN live_tv_favorites f ON f.channel_id = c.id AND f.profile_id = ?
      WHERE c.user_id = ? AND (? IS NULL OR c.profile_id = ? OR c.profile_id IS NULL) AND c.enabled = 1
    `;
    const params = [profileId, userId, profileId, profileId];

    if (category && category !== "All") {
      query += " AND c.category = ?";
      params.push(category);
    }

    if (search) {
      query += " AND c.name LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    if (favoritesOnly) {
      query += " AND f.id IS NOT NULL";
    }

    query += " ORDER BY c.channel_number ASC, c.name ASC";

    return this.db.prepare(query).all(...params);
  }

  toggleFavorite(userId, profileId, channelId) {
    // Verify channel belongs to this user
    const channel = this.db.prepare("SELECT id FROM live_tv_channels WHERE id=? AND user_id=?").get(channelId, userId);
    if (!channel) throw new Error("Channel not found or unauthorized");

    const existing = this.db.prepare("SELECT id FROM live_tv_favorites WHERE profile_id=? AND channel_id=?").get(profileId, channelId);

    if (existing) {
      this.db.prepare("DELETE FROM live_tv_favorites WHERE id=?").run(existing.id);
      return { isFavorite: false };
    } else {
      this.db.prepare("INSERT INTO live_tv_favorites (user_id, profile_id, channel_id) VALUES (?, ?, ?)").run(userId, profileId, channelId);
      return { isFavorite: true };
    }
  }

  recordHistory(userId, profileId, channelId, durationSeconds = 0) {
    const channel = this.db.prepare("SELECT id FROM live_tv_channels WHERE id=? AND user_id=?").get(channelId, userId);
    if (!channel) throw new Error("Channel not found or unauthorized");

    this.db.prepare(`
      INSERT INTO live_tv_history (user_id, profile_id, channel_id, watched_at, duration_seconds)
      VALUES (?, ?, ?, datetime('now'), ?)
    `).run(userId, profileId, channelId, durationSeconds);
  }

  getRecent(userId, profileId, limit = 10) {
    return this.db.prepare(`
      SELECT 
        c.id, c.provider_id, c.channel_number, c.name, c.logo_url, c.category, c.stream_url,
        MAX(h.watched_at) as last_watched
      FROM live_tv_history h
      JOIN live_tv_channels c ON c.id = h.channel_id
      WHERE h.user_id=? AND h.profile_id=?
      GROUP BY c.id
      ORDER BY last_watched DESC
      LIMIT ?
    `).all(userId, profileId, limit);
  }
}

/**
 * Account-Scoped Import Job Lock Manager
 */
class ImportJobManager {
  /**
   * @param {import("better-sqlite3").Database} db 
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Recovers jobs that were interrupted by a server restart or timeout.
   */
  cleanupStaleJobs() {
    return this.db.prepare(`
      UPDATE epg_sync_jobs
      SET status = 'failed', error_message = 'STALE_LOCK_RECOVERED'
      WHERE status = 'running' AND expires_at < datetime('now')
    `).run();
  }

  acquireLock(userId, providerId, jobType = "playlist_import", ttlSeconds = 60) {
    this.cleanupStaleJobs();

    // Check for an active, non-expired job for this user
    const active = this.db.prepare(`
      SELECT job_id, status, started_at, expires_at
      FROM epg_sync_jobs
      WHERE user_id=? AND status='running' AND expires_at >= datetime('now')
    `).get(userId);

    if (active) {
      return { locked: false, activeJob: active };
    }

    const jobId = `job_${crypto.randomBytes(8).toString("hex")}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    this.db.prepare(`
      INSERT INTO epg_sync_jobs (job_id, user_id, provider_id, job_type, status, expires_at)
      VALUES (?, ?, ?, ?, 'running', ?)
    `).run(jobId, userId, providerId, jobType, expiresAt);

    return { locked: true, jobId };
  }

  releaseLock(jobId, status = "completed", { channelsFound = 0, channelsImported = 0, errorMessage = null } = {}) {
    this.db.prepare(`
      UPDATE epg_sync_jobs
      SET status=?, channels_found=?, channels_imported=?, completed_at=datetime('now'), error_message=?
      WHERE job_id=?
    `).run(status, channelsFound, channelsImported, errorMessage, jobId);
  }
}

module.exports = {
  ChannelRepository,
  ImportJobManager
};
