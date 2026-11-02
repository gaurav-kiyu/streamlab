"use strict";

const sax = require("sax");
const { Readable } = require("stream");

const MAX_EPG_PAYLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_MAX_PROGRAMS = 50000;
const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_TEXT_LENGTH = 32768; // 32 KB per text node

/**
 * Normalizes an XMLTV timestamp to an ISO 8601 UTC string.
 * 
 * Deterministic Timezone Semantics:
 * - If an explicit timezone offset is provided (e.g., '+0530', '-0400', 'UTC', 'Z'),
 *   the timestamp is converted to exact UTC.
 * - Per the official XMLTV DTD specification:
 *   "All dates and times in this DTD are in UTC unless specified otherwise."
 *   Therefore, un-offset timestamps (e.g., '20261101180000') are deterministically
 *   interpreted as UTC ('2026-11-01T18:00:00.000Z').
 * 
 * @param {string} str 
 * @returns {string|null} ISO 8601 UTC string or null if invalid
 */
function parseXmltvTimestamp(str) {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{2}:?\d{2}|[A-Za-z]+))?$/);
  if (!match) return null;

  const [_, year, month, day, hour, min, sec, offsetStr] = match;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10) - 1;
  const d = parseInt(day, 10);
  const h = parseInt(hour, 10);
  const mi = parseInt(min, 10);
  const s = parseInt(sec, 10);

  if (m < 0 || m > 11 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) {
    return null;
  }

  let utcMs = Date.UTC(y, m, d, h, mi, s);

  if (offsetStr) {
    const upper = offsetStr.toUpperCase();
    if (upper === "UTC" || upper === "Z" || upper === "GMT") {
      // Already UTC
    } else if (offsetStr.startsWith("+") || offsetStr.startsWith("-")) {
      const sign = offsetStr[0] === "+" ? 1 : -1;
      const cleanOffset = offsetStr.substring(1).replace(":", "");
      const offH = parseInt(cleanOffset.substring(0, 2), 10) || 0;
      const offM = parseInt(cleanOffset.substring(2, 4), 10) || 0;
      const totalOffsetMs = (offH * 60 + offM) * 60 * 1000 * sign;
      utcMs -= totalOffsetMs;
    }
  }

  return new Date(utcMs).toISOString();
}

/**
 * Unescapes basic XML entities.
 * @param {string} str 
 * @returns {string}
 */
function unescapeXml(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Creates and configures a streaming SAX-based XMLTV parser core.
 * Enforces incremental chunk processing, bounded memory, max text-node size,
 * max nesting depth, and strict entity/DOCTYPE prohibition.
 * 
 * @param {object} options
 * @param {function} onChannel
 * @param {function} onProgramme
 * @param {function} onError
 * @returns {import("sax").SAXParser}
 */
function createSaxEpgParser(options, onChannel, onProgramme, onError) {
  const maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
  const maxTextLength = options.maxTextLength || DEFAULT_MAX_TEXT_LENGTH;
  const maxPrograms = options.maxPrograms || DEFAULT_MAX_PROGRAMS;

  let depth = 0;
  let currentChannel = null;
  let currentProgramme = null;
  let currentTag = null;
  let currentText = "";
  let programCount = 0;
  const seenProgramKeys = new Set();

  const isStrict = options.strict === true;
  const parser = sax.parser(isStrict, { lowercase: true, trim: false });

  parser.ondoctype = () => {
    const err = new Error("Security Violation: DTD and external entities are prohibited in XMLTV feeds");
    err.code = "XXE_DETECTED";
    onError(err);
  };

  parser.onopentag = (node) => {
    depth++;
    if (depth > maxDepth) {
      const err = new Error(`XML nesting depth exceeded maximum permitted limit of ${maxDepth}`);
      err.code = "MAX_DEPTH_EXCEEDED";
      return onError(err);
    }

    const tagName = node.name.toLowerCase();
    currentTag = tagName;
    currentText = "";

    if (tagName === "channel") {
      currentChannel = {
        id: node.attributes.id ? String(node.attributes.id).trim() : "",
        name: "",
        logoUrl: "",
        channelNumber: null
      };
    } else if (tagName === "programme") {
      if (programCount >= maxPrograms) {
        return; // Bounded programme count
      }
      currentProgramme = {
        channelId: node.attributes.channel ? String(node.attributes.channel).trim() : "",
        startRaw: node.attributes.start ? String(node.attributes.start).trim() : "",
        stopRaw: node.attributes.stop ? String(node.attributes.stop).trim() : "",
        title: "",
        description: "",
        category: "",
        posterUrl: ""
      };
    } else if (tagName === "icon") {
      const src = node.attributes.src ? String(node.attributes.src).trim() : "";
      if (currentProgramme) {
        currentProgramme.posterUrl = src;
      } else if (currentChannel) {
        currentChannel.logoUrl = src;
      }
    }
  };

  parser.ontext = (text) => {
    currentText += text;
    if (currentText.length > maxTextLength) {
      const err = new Error(`XML text node exceeded maximum permitted limit of ${maxTextLength} characters`);
      err.code = "TEXT_NODE_TOO_LARGE";
      return onError(err);
    }
  };

  parser.oncdata = (cdata) => {
    currentText += cdata;
    if (currentText.length > maxTextLength) {
      const err = new Error(`XML text node exceeded maximum permitted limit of ${maxTextLength} characters`);
      err.code = "TEXT_NODE_TOO_LARGE";
      return onError(err);
    }
  };

  parser.onclosetag = (tagName) => {
    depth--;
    const tag = tagName.toLowerCase();
    const trimmed = unescapeXml(currentText.trim());

    if (currentChannel) {
      if (tag === "display-name" && !currentChannel.name) {
        currentChannel.name = trimmed;
      } else if ((tag === "lcn" || tag === "channel-num") && !currentChannel.channelNumber) {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) currentChannel.channelNumber = num;
      } else if (tag === "channel") {
        if (currentChannel.id) {
          if (!currentChannel.name) currentChannel.name = currentChannel.id;
          onChannel(currentChannel);
        }
        currentChannel = null;
      }
    } else if (currentProgramme) {
      if (tag === "title" && !currentProgramme.title) {
        currentProgramme.title = trimmed;
      } else if ((tag === "desc" || tag === "description") && !currentProgramme.description) {
        currentProgramme.description = trimmed;
      } else if (tag === "category" && !currentProgramme.category) {
        currentProgramme.category = trimmed;
      } else if (tag === "programme") {
        if (currentProgramme.channelId && currentProgramme.startRaw && currentProgramme.stopRaw) {
          const startUtc = parseXmltvTimestamp(currentProgramme.startRaw);
          const stopUtc = parseXmltvTimestamp(currentProgramme.stopRaw);

          if (startUtc && stopUtc) {
            const dedupeKey = `${currentProgramme.channelId}|${startUtc}|${stopUtc}`;
            if (!seenProgramKeys.has(dedupeKey)) {
              seenProgramKeys.add(dedupeKey);
              programCount++;
              onProgramme({
                channelId: currentProgramme.channelId,
                title: currentProgramme.title || "Untitled Programme",
                description: currentProgramme.description || "",
                category: currentProgramme.category || "General",
                startUtc,
                stopUtc,
                posterUrl: currentProgramme.posterUrl || ""
              });
            }
          }
        }
        currentProgramme = null;
      }
    }
    currentText = "";
  };

  parser.onerror = (err) => {
    if (!err.code) err.code = "XML_PARSE_ERROR";
    onError(err);
  };

  return parser;
}

/**
 * True streaming, bounded-memory SAX parser for XMLTV feeds.
 * Works with stream.Readable, string, or Buffer.
 * 
 * Supports:
 * - Incremental chunk streaming without buffering 25 MB into RAM
 * - Incremental staging writes via `options.onProgrammeBatch`
 * - Payload size ceiling enforcement (`maxBytes`)
 * - Deep XML nesting prevention (`maxDepth`)
 * - Oversized text node prevention (`maxTextLength`)
 * - Cancellation via `options.signal` (AbortSignal)
 * - Deterministic timestamp normalization to UTC
 * - Duplicate programme deduplication
 * - Strict prohibition of <!DOCTYPE and <!ENTITY (XXE / Billion Laughs)
 * 
 * @param {string|Buffer|import("stream").Readable} input 
 * @param {object} options 
 * @returns {Promise<{ channels: Array, programs: Array, programmes: Array, totalPrograms: number }>}
 */
function parseXmltvStream(input, options = {}) {
  return new Promise((resolve, reject) => {
    const maxBytes = options.maxBytes || MAX_EPG_PAYLOAD_BYTES;
    const batchSize = options.batchSize || 500;
    const onProgrammeBatch = options.onProgrammeBatch || null;
    const signal = options.signal || null;

    if (!input) {
      return resolve({ channels: [], programs: [], programmes: [], totalPrograms: 0 });
    }

    if (signal && signal.aborted) {
      const err = new Error("Import was cancelled by client");
      err.code = "IMPORT_CANCELLED";
      return reject(err);
    }

    const channels = [];
    const programs = [];
    let currentBatch = [];
    let totalPrograms = 0;
    let bytesRead = 0;
    let isSettled = false;

    function fail(err) {
      if (!isSettled) {
        isSettled = true;
        reject(err);
      }
    }

    if (signal) {
      signal.addEventListener("abort", () => {
        const err = new Error("Import was cancelled by client");
        err.code = "IMPORT_CANCELLED";
        fail(err);
      }, { once: true });
    }

    const saxParser = createSaxEpgParser(
      options,
      (ch) => {
        channels.push(ch);
      },
      (pr) => {
        totalPrograms++;
        if (onProgrammeBatch) {
          currentBatch.push(pr);
          if (currentBatch.length >= batchSize) {
            const batchToFlush = currentBatch;
            currentBatch = [];
            onProgrammeBatch(batchToFlush);
          }
        } else {
          programs.push(pr);
        }
      },
      (err) => {
        fail(err);
      }
    );

    // If input is already string or Buffer
    if (typeof input === "string" || Buffer.isBuffer(input)) {
      const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
      if (buf.length > maxBytes) {
        const err = new Error(`XMLTV payload exceeded maximum allowed size of ${maxBytes} bytes`);
        err.code = "EPG_PAYLOAD_TOO_LARGE";
        return fail(err);
      }

      // Check for raw doctype entity signature upfront
      const headChunk = buf.subarray(0, Math.min(buf.length, 4096)).toString("utf8");
      if (/<(!DOCTYPE|!ENTITY)/i.test(headChunk)) {
        const err = new Error("Security Violation: DTD and external entities are prohibited in XMLTV feeds");
        err.code = "XXE_DETECTED";
        return fail(err);
      }

      try {
        // Chunked feed to SAX parser (16 KB chunks) with boundary tail buffer
        const CHUNK_SIZE = 16384;
        let bufTail = "";
        for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
          if (isSettled) break;
          const chunk = buf.subarray(i, Math.min(i + CHUNK_SIZE, buf.length));
          const chunkStr = chunk.toString("utf8");
          if (/<(!DOCTYPE|!ENTITY)/i.test(bufTail + chunkStr)) {
            const err = new Error("Security Violation: DTD and external entities are prohibited in XMLTV feeds");
            err.code = "XXE_DETECTED";
            return fail(err);
          }
          bufTail = chunkStr.slice(-16);
          saxParser.write(chunkStr);
        }
        if (!isSettled) {
          saxParser.close();
          if (onProgrammeBatch && currentBatch.length > 0) {
            onProgrammeBatch(currentBatch);
            currentBatch = [];
          }
          isSettled = true;
          return resolve({
            channels,
            programs,
            programmes: programs,
            totalPrograms
          });
        }
      } catch (err) {
        return fail(err);
      }
      return;
    }

    // Otherwise, input is a Readable stream
    const readable = input;
    let streamTail = "";
    readable.on("data", (chunk) => {
      if (isSettled) return;
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        readable.destroy();
        const err = new Error(`XMLTV payload exceeded maximum allowed size of ${maxBytes} bytes`);
        err.code = "EPG_PAYLOAD_TOO_LARGE";
        return fail(err);
      }

      const chunkStr = chunk.toString("utf8");
      if (/<(!DOCTYPE|!ENTITY)/i.test(streamTail + chunkStr)) {
        readable.destroy();
        const err = new Error("Security Violation: DTD and external entities are prohibited in XMLTV feeds");
        err.code = "XXE_DETECTED";
        return fail(err);
      }
      streamTail = chunkStr.slice(-16);

      try {
        saxParser.write(chunkStr);
      } catch (e) {
        readable.destroy();
        fail(e);
      }
    });

    readable.on("error", (err) => {
      fail(err);
    });

    readable.on("end", async () => {
      if (!isSettled) {
        try {
          saxParser.close();
          if (onProgrammeBatch && currentBatch.length > 0) {
            await onProgrammeBatch(currentBatch);
            currentBatch = [];
          }
          isSettled = true;
          resolve({
            channels,
            programs,
            programmes: programs,
            totalPrograms
          });
        } catch (e) {
          fail(e);
        }
      }
    });
  });
}

/**
 * Synchronous / promise-compatible wrapper maintaining 100% backward compatibility
 * with existing tests and synchronous callers while backed by SAX parser core.
 * 
 * @param {string|Buffer|import("stream").Readable} xmlContent 
 * @param {object} options 
 * @returns {{ channels: Array, programs: Array, programmes: Array, totalPrograms: number }}
 */
function parseXmltv(xmlContent, options = {}) {
  const maxBytes = options.maxBytes || MAX_EPG_PAYLOAD_BYTES;
  const maxPrograms = options.maxPrograms || DEFAULT_MAX_PROGRAMS;

  if (!xmlContent || (typeof xmlContent !== "string" && !Buffer.isBuffer(xmlContent))) {
    return { channels: [], programs: [], programmes: [], totalPrograms: 0 };
  }

  const byteLen = Buffer.isBuffer(xmlContent) ? xmlContent.length : Buffer.byteLength(xmlContent, "utf8");
  if (byteLen > maxBytes) {
    const err = new Error(`XMLTV payload exceeded maximum allowed size of ${maxBytes} bytes`);
    err.code = "EPG_PAYLOAD_TOO_LARGE";
    throw err;
  }

  // Pre-emptive check for entity expansion / DOCTYPE
  const rawStr = typeof xmlContent === "string" ? xmlContent : xmlContent.toString("utf8");
  if (/<(!DOCTYPE|!ENTITY)/i.test(rawStr)) {
    const err = new Error("Security Violation: DTD and external entities are prohibited in XMLTV feeds");
    err.code = "XXE_DETECTED";
    throw err;
  }

  const channels = [];
  const programs = [];
  let thrownError = null;

  const parser = createSaxEpgParser(
    options,
    (ch) => channels.push(ch),
    (pr) => {
      if (programs.length < maxPrograms) {
        programs.push(pr);
      }
    },
    (err) => {
      thrownError = err;
    }
  );

  try {
    parser.write(rawStr).close();
  } catch (e) {
    if (thrownError) {
      if (!thrownError.code) thrownError.code = "XML_PARSE_ERROR";
      throw thrownError;
    }
    // Map XML parsing error
    const mapped = new Error(`XML parsing error: ${e.message}`);
    mapped.code = "XML_PARSE_ERROR";
    throw mapped;
  }

  if (thrownError) {
    if (!thrownError.code) thrownError.code = "XML_PARSE_ERROR";
    throw thrownError;
  }

  return {
    channels,
    programs,
    programmes: programs,
    totalPrograms: programs.length
  };
}

module.exports = {
  MAX_EPG_PAYLOAD_BYTES,
  DEFAULT_MAX_PROGRAMS,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_TEXT_LENGTH,
  parseXmltvTimestamp,
  unescapeXml,
  createSaxEpgParser,
  parseXmltvStream,
  parseXmltv
};
