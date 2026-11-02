"use strict";

const http = require("http");
const https = require("https");
const dns = require("dns").promises;
const net = require("net");
const zlib = require("zlib");

/**
 * Checks if an IPv4 address is in any private, loopback, link-local, multicast, or reserved range.
 * @param {string} ip 
 * @returns {boolean} true if forbidden, false if public
 */
function isForbiddenIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;
  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private RFC 1918)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private RFC 1918)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (Shared Address / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future Use)
  if (a >= 240) return true;
  // Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in any private, loopback, link-local, multicast, or reserved range.
 * @param {string} ip 
 * @returns {boolean} true if forbidden, false if public
 */
function isForbiddenIPv6(ip) {
  const normalized = ip.toLowerCase();

  // Loopback (::1) and Unspecified (::)
  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1" || normalized === "0:0:0:0:0:0:0:0") {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:") || normalized.includes(":ffff:")) {
    const lastPart = normalized.split(":").pop();
    if (net.isIPv4(lastPart)) {
      return isForbiddenIPv4(lastPart);
    }
    // Hex format IPv4-mapped (e.g. 7f00:0001)
    const hexParts = normalized.replace(/^.*:ffff:/i, "").split(":");
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const a = (high >> 8) & 0xff;
        const b = high & 0xff;
        const c = (low >> 8) & 0xff;
        const d = low & 0xff;
        return isForbiddenIPv4(`${a}.${b}.${c}.${d}`);
      }
    }
  }

  // Unique Local Address (ULA) fc00::/7 (starts with fc or fd)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  // Link-Local fe80::/10 (starts with fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(normalized)) {
    return true;
  }

  // Multicast ff00::/8
  if (normalized.startsWith("ff")) {
    return true;
  }

  // Documentation prefix 2001:db8::/32
  if (normalized.startsWith("2001:db8") || normalized.startsWith("2001:0db8")) {
    return true;
  }

  return false;
}

/**
 * Validates whether an IP address is forbidden.
 * @param {string} ip 
 * @returns {boolean} true if forbidden
 */
function isForbiddenIP(ip) {
  if (net.isIPv4(ip)) return isForbiddenIPv4(ip);
  if (net.isIPv6(ip)) return isForbiddenIPv6(ip);
  return true; // Not a recognized IP format
}

/**
 * Resolves all DNS records for a URL and pins a verified public IP address.
 * Rejects if any resolved record is within a prohibited range (mixed response protection).
 * @param {string} rawUrl 
 * @returns {Promise<{ parsedUrl: URL, pinnedIp: string }>}
 */
async function validateAndPinUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    const err = new Error("Invalid URL format");
    err.code = "INVALID_URL";
    throw err;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    const err = new Error(`Unsupported URL protocol: '${parsedUrl.protocol}'. Only HTTP and HTTPS are permitted.`);
    err.code = "UNSUPPORTED_PROTOCOL";
    throw err;
  }

  const hostname = parsedUrl.hostname;
  if (!hostname) {
    const err = new Error("URL is missing hostname");
    err.code = "MISSING_HOSTNAME";
    throw err;
  }

  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isForbiddenIP(hostname)) {
      const err = new Error(`Direct connection to private/reserved IP ${hostname} is blocked.`);
      err.code = "FORBIDDEN_IP_RANGE";
      throw err;
    }
    return { parsedUrl, pinnedIp: hostname };
  }

  // Resolve all IPv4 and IPv6 addresses
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (e) {
    const err = new Error(`DNS resolution failed for hostname '${hostname}': ${e.message}`);
    err.code = "DNS_RESOLUTION_FAILED";
    throw err;
  }

  if (!addresses || addresses.length === 0) {
    const err = new Error(`No DNS records found for '${hostname}'`);
    err.code = "DNS_NO_RECORDS";
    throw err;
  }

  // Security check: If ANY resolved address is private, reject immediately (Mixed DNS protection)
  for (const entry of addresses) {
    if (isForbiddenIP(entry.address)) {
      const err = new Error(`Hostname '${hostname}' resolved to prohibited address ${entry.address}. Request blocked.`);
      err.code = "FORBIDDEN_IP_RANGE";
      throw err;
    }
  }

  // Pin the first verified address
  const pinnedIp = addresses[0].address;
  return { parsedUrl, pinnedIp };
}

/**
 * Executes a secure outbound HTTP/HTTPS GET request with:
 * - Pinned IP socket connection (immune to DNS rebinding)
 * - TLS SNI and hostname verification preserved
 * - Streaming byte limits (default: 5 MB)
 * - Strict timeout (default: 8,000 ms)
 * - Safe redirect following with recursive SSRF checks (max 3 redirects)
 * 
 * @param {string} rawUrl 
 * @param {object} options 
 * @returns {Promise<{ body: string, contentType: string, statusCode: number, finalUrl: string }>}
 */
async function secureFetch(rawUrl, options = {}) {
  const maxBytes = options.maxBytes || 5 * 1024 * 1024; // 5 MB ceiling
  const timeoutMs = options.timeoutMs || 8000;          // 8 seconds total timeout
  const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 3;
  let currentUrl = rawUrl;
  let redirectCount = 0;
  const visitedUrls = new Set([rawUrl]);

  while (true) {
    const { parsedUrl, pinnedIp } = await validateAndPinUrl(currentUrl);

    const client = parsedUrl.protocol === "https:" ? https : http;
    const port = parsedUrl.port ? Number(parsedUrl.port) : (parsedUrl.protocol === "https:" ? 443 : 80);

    const result = await new Promise((resolve, reject) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          req.destroy(new Error("REQUEST_TIMEOUT"));
          const err = new Error(`Request to ${parsedUrl.hostname} timed out after ${timeoutMs}ms`);
          err.code = "REQUEST_TIMEOUT";
          reject(err);
        }
      }, timeoutMs);

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": "StreamLab/1.1.0 (LiveTV-SecureFetcher)",
          "Accept": "*/*",
          "Connection": "close"
        },
        // DNS Rebinding Defense: Pinned IP lookup
        lookup: (host, opts, cb) => {
          cb(null, pinnedIp, net.isIPv6(pinnedIp) ? 6 : 4);
        }
      };

      const req = client.request(reqOptions, (res) => {
        const statusCode = res.statusCode || 0;

        // Handle redirects securely
        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          clearTimeout(timer);
          res.resume(); // drain response
          const location = res.headers.location;
          if (!location) {
            const err = new Error("Redirect response missing Location header");
            err.code = "INVALID_REDIRECT";
            return reject(err);
          }
          const nextUrl = new URL(location, parsedUrl).toString();
          return resolve({ redirect: nextUrl });
        }

        if (statusCode < 200 || statusCode >= 300) {
          clearTimeout(timer);
          res.resume();
          const err = new Error(`Remote server responded with HTTP ${statusCode}`);
          err.code = "UPSTREAM_HTTP_ERROR";
          err.statusCode = statusCode;
          return reject(err);
        }

        const contentEncoding = (res.headers["content-encoding"] || "").toLowerCase();
        let streamToRead = res;
        let decompressor = null;

        if (contentEncoding === "gzip" || contentEncoding === "x-gzip") {
          decompressor = zlib.createGunzip();
          streamToRead = res.pipe(decompressor);
        } else if (contentEncoding === "deflate") {
          decompressor = zlib.createInflate();
          streamToRead = res.pipe(decompressor);
        }

        let totalBytes = 0;
        const chunks = [];

        streamToRead.on("data", (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            clearTimeout(timer);
            req.destroy();
            if (decompressor) decompressor.destroy();
            const err = new Error(`Response exceeded maximum permitted size of ${maxBytes} bytes`);
            err.code = "PAYLOAD_TOO_LARGE";
            if (!isSettled) {
              isSettled = true;
              reject(err);
            }
          } else {
            chunks.push(chunk);
          }
        });

        streamToRead.on("end", () => {
          clearTimeout(timer);
          if (!isSettled) {
            isSettled = true;
            const body = Buffer.concat(chunks).toString("utf8");
            resolve({
              body,
              contentType: res.headers["content-type"] || "",
              statusCode,
              finalUrl: currentUrl
            });
          }
        });

        streamToRead.on("error", (e) => {
          clearTimeout(timer);
          req.destroy();
          if (!isSettled) {
            isSettled = true;
            reject(e);
          }
        });

        res.on("error", (e) => {
          clearTimeout(timer);
          req.destroy();
          if (!isSettled) {
            isSettled = true;
            reject(e);
          }
        });
      });

      req.on("error", (e) => {
        clearTimeout(timer);
        if (!isSettled) {
          isSettled = true;
          reject(e);
        }
      });

      req.end();
    });

    if (result.redirect) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        const err = new Error(`Too many redirects (exceeded limit of ${maxRedirects})`);
        err.code = "TOO_MANY_REDIRECTS";
        throw err;
      }
      if (visitedUrls.has(result.redirect)) {
        const err = new Error(`Redirect loop detected to: ${result.redirect}`);
        err.code = "REDIRECT_LOOP";
        throw err;
      }
      visitedUrls.add(result.redirect);
      currentUrl = result.redirect;
      continue;
    }

    return result;
  }
}

module.exports = {
  isForbiddenIPv4,
  isForbiddenIPv6,
  isForbiddenIP,
  validateAndPinUrl,
  secureFetch
};
