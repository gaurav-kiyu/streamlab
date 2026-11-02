import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSettings, saveSettings, getAuthToken, setAuthToken } from "./settings.js";

const CONFIG_CACHE_KEY = "cachedRemoteConfig";

async function request(path, options = {}, timeoutMs = 6000) {
  const { serverUrl, offlineMode } = getSettings();
  if (offlineMode) throw new Error("Offline mode active");

  const base = (serverUrl || "http://localhost:3000").replace(/\/+$/, "");
  const token = await getAuthToken();

  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Server responded with ${res.status}`);
    }
    return data;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("Server request timed out");
    throw e;
  }
}

// ---- Remote Config & Announcements ----
export async function fetchRemoteConfig() {
  try {
    const data = await request("/api/config", {}, 4000);
    await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(data));
    return data;
  } catch (e) {
    // Return cached config if server is unreachable
    try {
      const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return { showArchiveRows: true, downloadsEnabled: true, featured: [] };
  }
}

// ---- Authentication ----
export async function login(username, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  await setAuthToken(data.token);
  await saveSettings({ currentUser: data.user });
  return data.user;
}

export async function signup(username, password) {
  const data = await request("/api/auth/signup", {
    method: "POST",
    body: { username, password },
  });
  await setAuthToken(data.token);
  await saveSettings({ currentUser: data.user });
  return data.user;
}

export async function logout() {
  await setAuthToken("");
  await saveSettings({ currentUser: null, activeProfile: null });
}

// ---- Multi-User Profiles ----
export async function fetchProfiles() {
  try {
    const data = await request("/api/profiles");
    return data.profiles || [];
  } catch {
    return [];
  }
}

export async function createProfile(name, isKids = false, pin = null) {
  return request("/api/profiles", {
    method: "POST",
    body: { name, isKids, pin },
  });
}

export async function deleteProfile(id) {
  return request(`/api/profiles/${id}`, { method: "DELETE" });
}

// ---- Cloud Progress & Watchlist Sync ----
export async function syncCloudProgress(item, url, position, duration) {
  const settings = getSettings();
  if (!settings.currentUser) return; // Only sync if logged in

  try {
    await request("/api/sync/progress", {
      method: "POST",
      body: {
        profileId: settings.activeProfile?.id || null,
        mediaId: String(item.id),
        title: item.title,
        posterPath: item.poster_path,
        streamUrl: url,
        position,
        duration,
      },
    }, 3000);
  } catch {}
}

export async function syncCloudWatchlistToggle(item) {
  const settings = getSettings();
  if (!settings.currentUser) return null;

  try {
    const data = await request("/api/sync/watchlist/toggle", {
      method: "POST",
      body: {
        profileId: settings.activeProfile?.id || null,
        item,
      },
    });
    return data.inList;
  } catch {
    return null;
  }
}

// ---- TMDB Proxy (Keeps API key secure on server) ----
export async function searchMoviesProxy(query) {
  return request(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
}

export async function discoverMoviesProxy(type = "movie", params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/tmdb/discover?type=${type}&${qs}`);
}

// ---- Live TV Subsystem (Phase 16) ----
export async function fetchLiveTvProviders(profileId) {
  const qs = profileId ? `?profileId=${profileId}` : "";
  return request(`/api/livetv/providers${qs}`);
}

export async function createLiveTvProvider(data) {
  return request("/api/livetv/providers", {
    method: "POST",
    body: data,
  });
}

export async function deleteLiveTvProvider(id) {
  return request(`/api/livetv/providers/${id}`, {
    method: "DELETE",
  });
}

export async function importLiveTvPlaylist(data) {
  return request("/api/livetv/import", {
    method: "POST",
    body: data,
  }, 12000);
}

export async function fetchLiveTvChannels(profileId, options = {}) {
  const params = new URLSearchParams();
  if (profileId) params.set("profileId", profileId);
  if (options.category && options.category !== "All") params.set("category", options.category);
  if (options.search) params.set("search", options.search);
  if (options.favoritesOnly) params.set("favoritesOnly", "true");
  return request(`/api/livetv/channels?${params.toString()}`);
}

export async function toggleLiveTvFavorite(channelId, profileId) {
  return request(`/api/livetv/channels/${channelId}/favorite`, {
    method: "POST",
    body: { profileId },
  });
}

export async function recordLiveTvHistory(channelId, profileId, duration = 0) {
  return request(`/api/livetv/channels/${channelId}/history`, {
    method: "POST",
    body: { profileId, duration },
  });
}

export async function fetchLiveTvRecent(profileId, limit = 10) {
  return request(`/api/livetv/recent?profileId=${profileId}&limit=${limit}`);
}

// ---- Live TV EPG Subsystem (Phase 17) ----
export async function fetchChannelCurrentProgram(channelId) {
  return request(`/api/livetv/epg/channels/${channelId}/current`);
}

export async function fetchChannelSchedule(channelId, startUtc, endUtc) {
  const params = new URLSearchParams();
  if (startUtc) params.set("startUtc", startUtc);
  if (endUtc) params.set("endUtc", endUtc);
  return request(`/api/livetv/epg/channels/${channelId}/schedule?${params.toString()}`);
}

export async function fetchEpgGuide(profileId, startUtc, endUtc) {
  const params = new URLSearchParams();
  if (profileId) params.set("profileId", profileId);
  if (startUtc) params.set("startUtc", startUtc);
  if (endUtc) params.set("endUtc", endUtc);
  return request(`/api/livetv/epg/guide?${params.toString()}`);
}

export async function importEpg(data) {
  return request("/api/livetv/epg/import", {
    method: "POST",
    body: data,
  }, 20000);
}

export async function fetchEpgJob(jobId) {
  return request(`/api/livetv/epg/jobs/${jobId}`);
}
