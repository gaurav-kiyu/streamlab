import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { TMDB_KEY } from "./config.js";

const KEY = "settings";
const PASS_KEY = "jfPass";
const TOKEN_KEY = "userAuthToken";
const TMDB_SECURE_KEY = "tmdbSecretKey";

let current = {
  serverUrl: "http://localhost:3000",
  tmdbKey: TMDB_KEY,
  jfUrl: "",
  jfUser: "",
  jfPass: "",
  lang: "hi",
  dataSaver: false,
  quality: "auto",
  uiLang: null,
  currentUser: null,
  activeProfile: null,
  offlineMode: false,
};

export const getSettings = () => current;

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = { ...current, ...JSON.parse(raw) };
  } catch {}

  // SecureStore for sensitive credentials
  try {
    current.jfPass = (await SecureStore.getItemAsync(PASS_KEY)) || "";
  } catch {}
  try {
    const secureTmdb = await SecureStore.getItemAsync(TMDB_SECURE_KEY);
    if (secureTmdb) current.tmdbKey = secureTmdb;
  } catch {}

  return current;
}

export async function saveSettings(next) {
  current = { ...current, ...next };
  const { jfPass, tmdbKey, ...rest } = current;

  // Non-sensitive preferences in AsyncStorage
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
  } catch {}

  // Passwords and API keys in SecureStore
  try {
    if (jfPass) await SecureStore.setItemAsync(PASS_KEY, jfPass);
    else await SecureStore.deleteItemAsync(PASS_KEY);
  } catch {}
  try {
    if (tmdbKey) await SecureStore.setItemAsync(TMDB_SECURE_KEY, tmdbKey);
    else await SecureStore.deleteItemAsync(TMDB_SECURE_KEY);
  } catch {}
}

export async function getAuthToken() {
  try {
    return (await SecureStore.getItemAsync(TOKEN_KEY)) || "";
  } catch {
    return "";
  }
}

export async function setAuthToken(token) {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}
