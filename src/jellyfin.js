// Client for your own Jellyfin server (https://jellyfin.org). Plays your library over HLS.
import { Platform } from "react-native";
import { getSettings } from "./settings.js";

export const QUALITIES = [
  { code: "auto", label: "Auto" }, { code: "480", label: "480p" }, { code: "720", label: "HD 720p" },
  { code: "1080", label: "FHD 1080p" }, { code: "1440", label: "QHD 1440p" }, { code: "2160", label: "4K" },
];
const BITRATE = { "480": 1500000, "720": 4000000, "1080": 8000000, "1440": 16000000, "2160": 35000000 };

let session = null; // { token, userId, base }

const authHeader = (token) =>
  `MediaBrowser Client="StreamLab", Device="${Platform.OS}", DeviceId="streamlab-${Platform.OS}", Version="1.2.0"` +
  (token ? `, Token="${token}"` : "");

const clean = (u) => u.trim().replace(/\/+$/, "");

export const jellyfinConfigured = () => {
  const s = getSettings();
  return !!(s.jfUrl && s.jfUser);
};

export async function connect() {
  const { jfUrl, jfUser, jfPass } = getSettings();
  const base = clean(jfUrl);
  const res = await fetch(`${base}/Users/AuthenticateByName`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Emby-Authorization": authHeader() },
    body: JSON.stringify({ Username: jfUser, Pw: jfPass }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Wrong username or password" : `Server returned ${res.status}`);
  const data = await res.json();
  session = { token: data.AccessToken, userId: data.User.Id, base };
  return session;
}

async function ensure() { return session || connect(); }

export async function loadLibrary() {
  if (!jellyfinConfigured()) return [];
  const s = await ensure();
  const res = await fetch(
    `${s.base}/Users/${s.userId}/Items?IncludeItemTypes=Movie&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=40&Fields=Overview`,
    { headers: { "X-Emby-Authorization": authHeader(s.token) } }
  );
  if (res.status === 401) { session = null; return loadLibrary(); }
  if (!res.ok) throw new Error(`Library error ${res.status}`);
  const { Items } = await res.json();
  const q = getSettings().quality || "auto";
  const qp = BITRATE[q] ? `&maxHeight=${q}&videoBitRate=${BITRATE[q]}` : "";
  const codec = q === "2160" ? "hevc,h264" : "h264";
  return Items.map((it) => ({
    id: it.Id,
    title: it.Name,
    overview: it.Overview || "",
    poster_path: `${s.base}/Items/${it.Id}/Images/Primary?maxWidth=342`,
    download: `${s.base}/Items/${it.Id}/Download?api_key=${s.token}`,
    stream: `${s.base}/Videos/${it.Id}/master.m3u8?MediaSourceId=${it.Id}&VideoCodec=${codec}&AudioCodec=aac&api_key=${s.token}${qp}`,
  }));
}
