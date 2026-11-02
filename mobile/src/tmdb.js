import { getSettings } from "./settings.js";
import { langByCode } from "./languages.js";

const BASE = "https://api.themoviedb.org/3";
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

export const img = (p, size = "w342") =>
  p ? (p.startsWith("http") ? p : `https://image.tmdb.org/t/p/${size}${p}`) : null;

export const backdropImg = (p, size = "w780") =>
  p ? (p.startsWith("http") ? p : `https://image.tmdb.org/t/p/${size}${p}`) : null;

async function fetchWithCache(url) {
  const cached = cache.get(url);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return cached.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, expires: now + CACHE_TTL_MS });
  return data;
}

// Maps standard TMDB v3 API paths into typed, allowlisted server proxy URLs
export function mapTmdbPathToProxy(path, base) {
  if (!path || typeof path !== "string") return null;
  const baseUrl = (base || "").replace(/\/+$/, "");
  const [cleanPath, queryString] = path.split("?");
  const qs = queryString ? `?${queryString}` : "";

  // 1. Discover
  if (cleanPath === "/discover/movie") {
    const sep = queryString ? "&" : "?";
    return `${baseUrl}/api/tmdb/discover${qs}${sep}type=movie`;
  }
  if (cleanPath === "/discover/tv") {
    const sep = queryString ? "&" : "?";
    return `${baseUrl}/api/tmdb/discover${qs}${sep}type=tv`;
  }

  // 2. Search
  if (cleanPath === "/search/movie") {
    const sep = queryString ? "&" : "?";
    return `${baseUrl}/api/tmdb/search${qs}${sep}type=movie`;
  }
  if (cleanPath === "/search/tv") {
    const sep = queryString ? "&" : "?";
    return `${baseUrl}/api/tmdb/search${qs}${sep}type=tv`;
  }
  if (cleanPath === "/search/multi") {
    const sep = queryString ? "&" : "?";
    return `${baseUrl}/api/tmdb/search${qs}${sep}type=multi`;
  }

  // 3. Similar
  const movieSimilarMatch = cleanPath.match(/^\/movie\/(\d+)\/similar$/);
  if (movieSimilarMatch) {
    return `${baseUrl}/api/tmdb/movie/${movieSimilarMatch[1]}/similar${qs}`;
  }
  const tvSimilarMatch = cleanPath.match(/^\/tv\/(\d+)\/similar$/);
  if (tvSimilarMatch) {
    return `${baseUrl}/api/tmdb/tv/${tvSimilarMatch[1]}/similar${qs}`;
  }

  // 4. Watch Providers
  const movieWatchMatch = cleanPath.match(/^\/movie\/(\d+)\/watch\/providers$/);
  if (movieWatchMatch) {
    return `${baseUrl}/api/tmdb/movie/${movieWatchMatch[1]}/watch-providers${qs}`;
  }
  const tvWatchMatch = cleanPath.match(/^\/tv\/(\d+)\/watch\/providers$/);
  if (tvWatchMatch) {
    return `${baseUrl}/api/tmdb/tv/${tvWatchMatch[1]}/watch-providers${qs}`;
  }

  // 5. Details
  const movieMatch = cleanPath.match(/^\/movie\/(\d+)$/);
  if (movieMatch) {
    return `${baseUrl}/api/tmdb/movie/${movieMatch[1]}${qs}`;
  }
  const tvMatch = cleanPath.match(/^\/tv\/(\d+)$/);
  if (tvMatch) {
    return `${baseUrl}/api/tmdb/tv/${tvMatch[1]}${qs}`;
  }

  return null;
}

async function get(path) {
  const key = getSettings().tmdbKey;
  if (!key) {
    // Route through explicit server proxy when local client key is not configured
    const { serverUrl } = getSettings();
    if (serverUrl) {
      const proxyUrl = mapTmdbPathToProxy(path, serverUrl);
      if (!proxyUrl) return null;
      const res = await fetch(proxyUrl).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        return json.results !== undefined ? json.results : json;
      }
    }
    return null;
  }

  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${key}`;
  const data = await fetchWithCache(url);
  return data.results !== undefined ? data.results : data;
}

const tv = (items) => (items || []).map((t) => ({ ...t, title: t.title || t.name, media: "tv" }));

export const GENRES = [
  { id: "all", name: "All Genres" },
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 10749, name: "Romance" },
  { id: 53, name: "Thriller" },
  { id: 10751, name: "Family" },
];

// Rows for one content language.
export async function loadRows(code = "hi") {
  const L = langByCode(code);
  const lang = encodeURIComponent(L.tmdb);
  const movies = (extra) => get(`/discover/movie?with_original_language=${lang}&region=IN${extra}`);

  const jobs = [
    ["Popular", movies("&sort_by=popularity.desc")],
    ["Top rated", movies("&sort_by=vote_average.desc&vote_count.gte=200")],
    ...GENRES.filter((g) => g.id !== "all").map((g) => [g.name, movies(`&with_genres=${g.id}&sort_by=popularity.desc`)]),
    ["TV shows", get(`/discover/tv?with_original_language=${lang}&sort_by=popularity.desc`).then(tv)],
  ];

  if (code === "hi") {
    jobs.push([
      "South Indian films (popular in Hindi)",
      get("/discover/movie?with_original_language=te%7Cta%7Cml%7Ckn&sort_by=popularity.desc&region=IN"),
    ]);
  }

  const done = await Promise.allSettled(jobs.map((j) => j[1]));
  return jobs
    .map(([title], i) => {
      const items = (done[i].status === "fulfilled" && Array.isArray(done[i].value)) ? done[i].value : [];
      return {
        title: title.startsWith("South") ? title : `${L.label}: ${title}`,
        items,
      };
    })
    .filter((r) => r.items.length > 0);
}

export async function searchMovies(query) {
  const q = query.trim();
  if (!q) return [];
  const results = await get(`/search/movie?query=${encodeURIComponent(q)}&region=IN`);
  return Array.isArray(results) ? results : [];
}

// Fetch rich details: backdrop, runtime, genres, rating, credits
export async function getMovieDetails(item) {
  if (!item || !item.id || typeof item.id !== "number") return null;
  const kind = item.media === "tv" ? "tv" : "movie";
  try {
    const data = await get(`/${kind}/${item.id}?append_to_response=credits`);
    return data;
  } catch {
    return null;
  }
}

// Fetch similar / recommended titles
export async function getSimilarMovies(item) {
  if (!item || !item.id || typeof item.id !== "number") return [];
  const kind = item.media === "tv" ? "tv" : "movie";
  try {
    const data = await get(`/${kind}/${item.id}/similar`);
    const results = Array.isArray(data) ? data : data?.results || [];
    return results.slice(0, 10).map((m) => ({
      ...m,
      title: m.title || m.name,
      media: kind,
    }));
  } catch {
    return [];
  }
}

// Where a title streams legally in India (JustWatch data via TMDB)
export async function getProviders(item) {
  if (!item || typeof item.id !== "number") return null;
  const kind = item.media === "tv" ? "tv" : "movie";
  try {
    const all = await get(`/${kind}/${item.id}/watch/providers`);
    const r = all && all.IN;
    if (!r) return null;
    const names = (a) => (a || []).map((x) => x.provider_name);
    return {
      link: r.link,
      free: [...names(r.free), ...names(r.ads)],
      subscription: names(r.flatrate),
      rent: names(r.rent),
    };
  } catch {
    return null;
  }
}
