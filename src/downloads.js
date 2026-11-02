// Offline downloads for direct video files (MP4). Streams that only exist as HLS can't be saved this way.
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "downloads";
const dir = FileSystem.documentDirectory + "downloads/";
const same = (a, b) => String(a) === String(b);

export async function loadDownloads() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || "[]"); } catch { return []; }
}

export async function startDownload(item, remoteUrl, onProgress) {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const path = dir + String(item.id).replace(/[^\w-]/g, "_") + ".mp4";
  const job = FileSystem.createDownloadResumable(remoteUrl, path, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const res = await job.downloadAsync();
  if (!res || res.status >= 400) throw new Error("Download failed");
  const entry = { id: item.id, title: item.title, overview: item.overview, poster_path: item.poster_path, url: res.uri };
  const list = (await loadDownloads()).filter((d) => !same(d.id, item.id));
  await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...list]));
  return entry;
}

export async function removeDownload(id) {
  const list = await loadDownloads();
  const hit = list.find((d) => same(d.id, id));
  if (hit) await FileSystem.deleteAsync(hit.url, { idempotent: true }).catch(() => {});
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((d) => !same(d.id, id))));
}
