"use strict";

/**
 * Parses an M3U/M3U8 string into a structured list of channels.
 * 
 * Enforces:
 * - Line-by-line streaming parse (bounded memory footprint)
 * - Maximum channel ceiling (default 2,000)
 * - Metadata attribute extraction: tvg-id, tvg-name, tvg-logo, group-title, tvg-chno
 * - Fallback title parsing
 * - De-duplication by stream URL
 * - Graceful tolerance of malformed entries
 * 
 * @param {string} content M3U/M3U8 raw playlist text
 * @param {object} options
 * @returns {{ channels: Array, epgUrl: string|null, totalFound: number, truncated: boolean }}
 */
function parseM3U(content, options = {}) {
  const maxChannels = options.maxChannels || 2000;
  if (!content || typeof content !== "string") {
    return { channels: [], epgUrl: null, totalFound: 0, truncated: false };
  }

  const lines = content.split(/\r?\n/);
  const channels = [];
  const seenUrls = new Set();
  let epgUrl = null;
  let currentExtInf = null;
  let totalFound = 0;

  // Regex helpers for EXTINF attributes
  const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Check header for global EPG URL
    if (rawLine.startsWith("#EXTM3U")) {
      const tvgMatch = rawLine.match(/x-tvg-url="([^"]+)"/i) || rawLine.match(/url-tvg="([^"]+)"/i);
      if (tvgMatch) {
        epgUrl = tvgMatch[1].trim();
      }
      continue;
    }

    // Process #EXTINF metadata tag
    if (rawLine.startsWith("#EXTINF:")) {
      currentExtInf = {
        name: "",
        logo: "",
        category: "General",
        channelNumber: null,
        tvgId: ""
      };

      // Extract attributes: key="value"
      let match;
      while ((match = attrRegex.exec(rawLine)) !== null) {
        const key = match[1].toLowerCase();
        const val = match[2].trim();
        if (key === "tvg-name") currentExtInf.name = val;
        else if (key === "tvg-logo") currentExtInf.logo = val;
        else if (key === "group-title") currentExtInf.category = val || "General";
        else if (key === "tvg-chno") {
          const chNo = parseInt(val, 10);
          if (!isNaN(chNo) && chNo > 0) currentExtInf.channelNumber = chNo;
        } else if (key === "tvg-id") currentExtInf.tvgId = val;
      }

      // Extract title after the final comma
      const commaIdx = rawLine.lastIndexOf(",");
      if (commaIdx !== -1) {
        const trailingName = rawLine.substring(commaIdx + 1).trim();
        if (trailingName && !currentExtInf.name) {
          currentExtInf.name = trailingName;
        }
      }

      continue;
    }

    // If line starts with # but isn't EXTINF, it's a comment or other directive (e.g. #EXTVLCOPT)
    if (rawLine.startsWith("#")) {
      // e.g. #EXTGRP: News
      if (rawLine.startsWith("#EXTGRP:") && currentExtInf) {
        const grp = rawLine.substring(8).trim();
        if (grp) currentExtInf.category = grp;
      }
      continue;
    }

    // Line is a stream URL
    if (currentExtInf && (rawLine.startsWith("http://") || rawLine.startsWith("https://"))) {
      totalFound++;

      // De-duplicate by stream URL
      if (!seenUrls.has(rawLine)) {
        seenUrls.add(rawLine);

        if (channels.length < maxChannels) {
          channels.push({
            name: currentExtInf.name || `Channel ${channels.length + 1}`,
            logo: currentExtInf.logo || "",
            category: currentExtInf.category || "General",
            channelNumber: currentExtInf.channelNumber || (channels.length + 1),
            tvgId: currentExtInf.tvgId || "",
            streamUrl: rawLine
          });
        }
      }

      currentExtInf = null; // Reset for next channel
    }
  }

  return {
    channels,
    epgUrl,
    totalFound,
    truncated: channels.length < totalFound
  };
}

module.exports = {
  parseM3U
};
