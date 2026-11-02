import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { searchMovies, img } from "../tmdb";
import { useT } from "../i18n";

const isTV = Platform.isTV;
const SEARCH_HISTORY_KEY = "streamlab_search_history";
const TRENDING_SEARCHES = ["Action", "Comedy", "Thriller", "Romance", "Hindi Classics", "Drama"];

function Result({ item, onPress }) {
  const [focused, setFocused] = useState(false);
  const uri = img(item.poster_path, "w154");
  const releaseYear = (item.release_date || "").slice(0, 4);

  return (
    <Pressable
      onPress={() => onPress(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={[styles.result, focused && styles.focused]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: "#172c3a", justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ color: "#8fa8b6", fontSize: 10, textAlign: "center" }}>No Poster</Text>
        </View>
      )}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.title}>{item.title}</Text>
        {releaseYear ? <Text style={styles.year}>{releaseYear}</Text> : null}
        <Text style={styles.meta} numberOfLines={2}>
          {item.overview || "No overview available."}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Search({ onSelect }) {
  const t = useT();
  const [text, setText] = useState("");
  const [mediaType, setMediaType] = useState("all"); // "all" | "movie" | "tv"
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(SEARCH_HISTORY_KEY)
      .then((raw) => {
        if (raw) setHistory(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const saveQuery = async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...history.filter((h) => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setHistory(next);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY).catch(() => {});
  };

  // Debounced TMDB search
  useEffect(() => {
    if (!text.trim()) {
      setResults([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      searchMovies(text, "multi")
        .then((res) => {
          setResults(res);
          saveQuery(text);
        })
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 380);

    return () => clearTimeout(timer);
  }, [text]);

  const onSelectTitle = (item) => {
    saveQuery(item.title);
    onSelect(item);
  };

  const displayedResults = useMemo(() => {
    if (mediaType === "all") return results;
    return results.filter((r) => (mediaType === "tv" ? r.media === "tv" : r.media !== "tv"));
  }, [results, mediaType]);

  return (
    <View style={[styles.container, isTV && styles.tvContainer]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t("searchPlaceholder")}
        placeholderTextColor="#8fa8b6"
        autoFocus={!isTV}
        returnKeyType="search"
        style={styles.input}
      />

      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color="#ff6b8b" />
          <Text style={styles.metaText}>{t("searching")}</Text>
        </View>
      )}

      {/* Media Type Filter Tabs (REQ-18-04) */}
      {results.length > 0 && (
        <View style={styles.filterRow}>
          {["all", "movie", "tv"].map((tType) => (
            <Pressable
              key={tType}
              style={[styles.filterTab, mediaType === tType && styles.filterTabActive]}
              onPress={() => setMediaType(tType)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${tType}`}
            >
              <Text style={[styles.filterTabText, mediaType === tType && styles.filterTabTextActive]}>
                {tType === "all" ? "All Results" : tType === "movie" ? "Movies" : "TV Shows"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Empty State: Trending Searches & Recent History */}
      {!text.trim() && (
        <View style={{ flex: 1 }}>
          {history.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <Pressable onPress={clearHistory}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.chipGrid}>
                {history.map((h, i) => (
                  <Pressable key={i} style={styles.chip} onPress={() => setText(h)}>
                    <Text style={styles.chipText}>🕒 {h}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Trending Categories</Text>
            <View style={styles.chipGrid}>
              {TRENDING_SEARCHES.map((cat, i) => (
                <Pressable key={i} style={[styles.chip, styles.trendingChip]} onPress={() => setText(cat)}>
                  <Text style={styles.chipText}>🔥 {cat}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* No results */}
      {!busy && text.trim() !== "" && displayedResults.length === 0 && (
        <View style={styles.centerNotice}>
          <Text style={styles.metaText}>{t("noResults")}</Text>
        </View>
      )}

      {/* Results List */}
      <FlatList
        data={displayedResults}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => <Result item={item} onPress={onSelectTitle} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#10202b", padding: 16 },
  tvContainer: { paddingHorizontal: 48, paddingVertical: 24 },
  input: {
    color: "#e8f1f5",
    fontSize: isTV ? 22 : 18,
    borderWidth: 2,
    borderColor: "#2a4557",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: "#172c3a",
  },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#172c3a",
    borderWidth: 1.5,
    borderColor: "#2a4557",
  },
  filterTabActive: { backgroundColor: "rgba(255,107,139,0.2)", borderColor: "#ff6b8b" },
  filterTabText: { color: "#8fa8b6", fontSize: isTV ? 16 : 13, fontWeight: "600" },
  filterTabTextActive: { color: "#ff6b8b", fontWeight: "700" },
  metaText: { color: "#8fa8b6", fontSize: 16 },
  historySection: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: "#e8f1f5", fontSize: 16, fontWeight: "700" },
  clearText: { color: "#ff6b8b", fontSize: 14, fontWeight: "600" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#172c3a",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#2a4557",
  },
  trendingChip: { borderColor: "rgba(255,107,139,0.4)" },
  chipText: { color: "#e8f1f5", fontSize: 14, fontWeight: "600" },
  result: {
    flexDirection: "row",
    gap: 14,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: "transparent",
    marginBottom: 8,
    backgroundColor: "#132330",
  },
  focused: { borderColor: "#ff6b8b", transform: [{ scale: 1.02 }] },
  thumb: { width: 64, height: 96, borderRadius: 6 },
  title: { color: "#e8f1f5", fontSize: 17, fontWeight: "700" },
  year: { color: "#ff6b8b", fontSize: 13, fontWeight: "600", marginTop: 2 },
  meta: { color: "#8fa8b6", marginTop: 4, fontSize: 14, lineHeight: 18 },
  centerNotice: { padding: 32, alignItems: "center" },
});

