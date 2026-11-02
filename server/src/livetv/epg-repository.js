"use strict";

class EPGRepository {
  /**
   * @param {import("better-sqlite3").Database} db 
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Inserts parsed XMLTV programs into the staging table prior to validation and atomic commit.
   * 
   * @param {string} jobId 
   * @param {Array} programs 
   * @returns {number} Count of staged programs
   */
  stagePrograms(jobId, programs) {
    if (!programs || programs.length === 0) return 0;

    const insertTx = this.db.transaction(() => {
      const insertStmt = this.db.prepare(`
        INSERT INTO epg_programs_staging 
          (job_id, channel_id, tvg_id, title, description, start_utc, stop_utc, category, poster_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pr of programs) {
        insertStmt.run(
          jobId,
          pr.channelId,
          pr.channelId, // tvg_id
          pr.title,
          pr.description || "",
          pr.startUtc,
          pr.stopUtc,
          pr.category || "General",
          pr.posterUrl || ""
        );
      }
    });

    insertTx();
    return programs.length;
  }

  /**
   * Discards staged programs if parsing or validation failed.
   * Preserves previous valid EPG data intact.
   * 
   * @param {string} jobId 
   */
  discardStagedPrograms(jobId) {
    this.db.prepare("DELETE FROM epg_programs_staging WHERE job_id=?").run(jobId);
  }

  /**
   * Cleans up orphaned or abandoned staging records resulting from process restarts or failed jobs.
   * @param {number} olderThanHours 
   * @returns {number} Count of removed staging records
   */
  cleanupStaleStaging(olderThanHours = 1) {
    const threshold = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
    return this.db.prepare("DELETE FROM epg_programs_staging WHERE created_at < ?").run(threshold).changes;
  }

  /**
   * Atomically commits staged programs into production epg_programs table.
   * Matches XMLTV channel IDs / tvg_ids to live_tv_channels.
   * 
   * @param {string} jobId 
   * @param {string} providerId 
   * @returns {{ committed: number, unmapped: number }}
   */
  commitStagedPrograms(jobId, providerId = null, userId = null) {
    const swapTx = this.db.transaction(() => {
      // 1. Fetch live channels for this provider or user
      let channels;
      if (providerId) {
        channels = this.db.prepare(`
          SELECT id, tvg_id, name FROM live_tv_channels WHERE provider_id=?
        `).all(providerId);
      } else if (userId) {
        channels = this.db.prepare(`
          SELECT id, tvg_id, name FROM live_tv_channels WHERE user_id=?
        `).all(userId);
      } else {
        channels = this.db.prepare(`
          SELECT id, tvg_id, name FROM live_tv_channels
        `).all();
      }

      const tvgMap = new Map();
      const nameMap = new Map();
      const channelIds = new Set();

      for (const ch of channels) {
        channelIds.add(ch.id);
        if (ch.tvg_id) tvgMap.set(ch.tvg_id.toLowerCase(), ch.id);
        if (ch.name) nameMap.set(ch.name.toLowerCase(), ch.id);
      }

      // 2. Fetch staged programs for this job
      const staged = this.db.prepare(`
        SELECT channel_id, title, description, start_utc, stop_utc, category, poster_url
        FROM epg_programs_staging
        WHERE job_id=?
      `).all(jobId);

      let committed = 0;
      let unmapped = 0;

      // 3. Clear existing programs ONLY for matched channels belonging to this provider
      const deleteStmt = this.db.prepare("DELETE FROM epg_programs WHERE channel_id=?");
      for (const chId of channelIds) {
        deleteStmt.run(chId);
      }

      // 4. Insert matched programs into epg_programs
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO epg_programs
          (channel_id, tvg_id, title, description, start_utc, stop_utc, category, poster_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of staged) {
        const rawKey = s.channel_id.toLowerCase();
        let targetChannelId = tvgMap.get(rawKey) || nameMap.get(rawKey);

        if (!targetChannelId) {
          // Fuzzy partial match
          for (const [name, id] of nameMap.entries()) {
            if (name.includes(rawKey) || rawKey.includes(name)) {
              targetChannelId = id;
              break;
            }
          }
        }

        if (targetChannelId) {
          insertStmt.run(
            targetChannelId,
            s.channel_id,
            s.title,
            s.description,
            s.start_utc,
            s.stop_utc,
            s.category,
            s.poster_url
          );
          committed++;
        } else {
          unmapped++;
        }
      }

      // 5. Cleanup staging rows
      this.db.prepare("DELETE FROM epg_programs_staging WHERE job_id=?").run(jobId);

      return { committed, unmapped };
    });

    return swapTx();
  }

  /**
   * Retrieves current and next programme for a channel with graceful fallback.
   * 
   * @param {string} channelId 
   * @param {string|null} nowUtc 
   * @returns {{ current: object, next: object|null, hasEpg: boolean }}
   */
  getCurrentAndNext(channelId, nowUtc = null) {
    const now = nowUtc || new Date().toISOString();

    const current = this.db.prepare(`
      SELECT id, channel_id, title, description, start_utc, stop_utc, category, poster_url
      FROM epg_programs
      WHERE channel_id=? AND start_utc <= ? AND stop_utc > ?
      ORDER BY start_utc DESC
      LIMIT 1
    `).get(channelId, now, now);

    let next = null;
    if (current) {
      next = this.db.prepare(`
        SELECT id, channel_id, title, description, start_utc, stop_utc, category, poster_url
        FROM epg_programs
        WHERE channel_id=? AND start_utc >= ?
        ORDER BY start_utc ASC
        LIMIT 1
      `).get(channelId, current.stop_utc);
    } else {
      next = this.db.prepare(`
        SELECT id, channel_id, title, description, start_utc, stop_utc, category, poster_url
        FROM epg_programs
        WHERE channel_id=? AND start_utc >= ?
        ORDER BY start_utc ASC
        LIMIT 1
      `).get(channelId, now);
    }

    const activeCurrent = current || {
      title: !next ? "Program Information Unavailable" : "Live Broadcast",
      description: !next ? "Schedule metadata not provided for this channel." : "",
      start_utc: now,
      stop_utc: next ? next.start_utc : new Date(Date.now() + 3600000).toISOString(),
      category: "General",
      isFallback: true
    };

    return {
      now: activeCurrent,
      current: activeCurrent,
      next: next || null,
      hasEpg: Boolean(current || next)
    };
  }

  /**
   * Retrieves schedule for a single channel in a time window.
   */
  getChannelSchedule(channelId, startUtc, endUtc) {
    return this.db.prepare(`
      SELECT id, channel_id, title, description, start_utc, stop_utc, category, poster_url
      FROM epg_programs
      WHERE channel_id=? AND start_utc < ? AND stop_utc > ?
      ORDER BY start_utc ASC
    `).all(channelId, endUtc, startUtc);
  }

  /**
   * Retrieves multi-channel guide data across all user channels for 10-foot EPG grid.
   */
  getMultiChannelGuide(userId, profileId, startUtc, endUtc) {
    const channels = this.db.prepare(`
      SELECT id, channel_number, name, logo_url, category, stream_url
      FROM live_tv_channels
      WHERE user_id=? AND (profile_id=? OR profile_id IS NULL) AND enabled=1
      ORDER BY channel_number ASC, name ASC
    `).all(userId, profileId);

    const scheduleStmt = this.db.prepare(`
      SELECT id, title, description, start_utc, stop_utc, category, poster_url
      FROM epg_programs
      WHERE channel_id=? AND start_utc < ? AND stop_utc > ?
      ORDER BY start_utc ASC
    `);

    const result = channels.map((ch) => {
      const schedule = scheduleStmt.all(ch.id, endUtc, startUtc);
      return {
        ...ch,
        programs: schedule
      };
    });

    return {
      guide: result,
      channels: result,
      timeWindow: { startUtc, endUtc }
    };
  }

  /**
   * Cleans up historical programmes older than retention window.
   */
  cleanupOldPrograms(retentionHours = 48) {
    const threshold = new Date(Date.now() - retentionHours * 3600 * 1000).toISOString();
    return this.db.prepare("DELETE FROM epg_programs WHERE stop_utc < ?").run(threshold).changes;
  }
}

module.exports = {
  EPGRepository
};
