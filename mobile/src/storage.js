import AsyncStorage from "@react-native-async-storage/async-storage";

const key = (url) => `pos:${url}`;

export async function loadPosition(url) {
  try { return parseFloat(await AsyncStorage.getItem(key(url))) || 0; } catch { return 0; }
}
export async function savePosition(url, seconds) {
  try { await AsyncStorage.setItem(key(url), String(seconds)); } catch {}
}
export async function clearPosition(url) {
  try { await AsyncStorage.removeItem(key(url)); } catch {}
}

// "Continue watching" list: newest first, max 12 entries
const RECENT = "recent";

export async function loadRecent() {
  try { return JSON.parse((await AsyncStorage.getItem(RECENT)) || "[]"); } catch { return []; }
}
export async function upsertRecent(item, url, position, duration) {
  try {
    const list = (await loadRecent()).filter((e) => e.url !== url);
    list.unshift({ id: item.id, title: item.title, overview: item.overview, poster_path: item.poster_path, url, position, duration });
    await AsyncStorage.setItem(RECENT, JSON.stringify(list.slice(0, 12)));
  } catch {}
}
export async function removeRecent(url) {
  try {
    const list = (await loadRecent()).filter((e) => e.url !== url);
    await AsyncStorage.setItem(RECENT, JSON.stringify(list));
  } catch {}
}

// "My list": saved titles
const LIST = "mylist";

export async function loadList() {
  try { return JSON.parse((await AsyncStorage.getItem(LIST)) || "[]"); } catch { return []; }
}
export async function toggleList(item) {
  const list = await loadList();
  const exists = list.some((m) => String(m.id) === String(item.id));
  const next = exists ? list.filter((m) => String(m.id) !== String(item.id)) : [item, ...list];
  try { await AsyncStorage.setItem(LIST, JSON.stringify(next)); } catch {}
  return !exists;
}
