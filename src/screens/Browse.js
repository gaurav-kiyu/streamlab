import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { loadRows, img, GENRES } from "../tmdb";
import { loadRecent, loadList } from "../storage";
import { loadDownloads } from "../downloads";
import { loadLibrary, jellyfinConfigured } from "../jellyfin";
import { loadPublicDomain, loadHindiArchive } from "../archive";
import { fetchRemoteConfig } from "../api";
import { LANGS } from "../languages";
import { useT } from "../i18n";
import { getSettings, saveSettings } from "../settings";

const isTV = Platform.isTV;
const W = isTV ? 220 : 130;
const H = W * 1.5;

function Chip({ lang, active, onPress }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={lang.label}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive, focused && styles.chipFocus]}
    >
      <Text style={styles.chipText}>{lang.native ? `${lang.native}  ${lang.label}` : lang.label}</Text>
    </Pressable>
  );
}

function Card({ item, onPress, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const uri = img(item.poster_path);
  const pct = item.duration ? Math.min(100, (item.position / item.duration) * 100) : 0;
  return (
    <Pressable
      hasTVPreferredFocus={autoFocus}
      onPress={() => onPress(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={[styles.card, focused && styles.cardFocused]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.placeholder]}>
          <Text style={styles.ph}>{item.title}</Text>
        </View>
      )}
      {pct > 0 && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      )}
    </Pressable>
  );
}

export default function Browse({ onSelect, onResume }) {
  const t = useT();
  const [lang, setLang] = useState(getSettings().lang || "hi");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [recent, setRecent] = useState([]);
  const [list, setList] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [lib, setLib] = useState([]);
  const [libError, setLibError] = useState(null);
  const [free, setFree] = useState([]);
  const [hindiFree, setHindiFree] = useState([]);
  const [remoteConfig, setRemoteConfig] = useState(null);
  const [error, setError] = useState(null);

  // Reload the shelves when language changes
  useEffect(() => {
    setLoadingRows(true);
    setError(null);
    loadRows(lang)
      .then((data) => {
        setRows(data);
        setLoadingRows(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoadingRows(false);
      });
  }, [lang]);

  useEffect(() => {
    loadHindiArchive().then(setHindiFree).catch(() => {});
    loadPublicDomain().then(setFree).catch(() => {});
    fetchRemoteConfig().then(setRemoteConfig).catch(() => {});
  }, []);

  // Refresh upon screen focus
  useFocusEffect(
    useCallback(() => {
      loadRecent().then(setRecent);
      loadList().then(setList);
      loadDownloads().then(setDownloads);
      setLibError(null);
      if (jellyfinConfigured()) loadLibrary().then(setLib).catch((e) => setLibError(e.message));
      else setLib([]);
    }, [])
  );

  const pick = (code) => {
    setLang(code);
    saveSettings({ lang: code });
  };

  const showHindiFree = lang === "hi" || lang === "all";
  const featuredItems = (remoteConfig?.featured || []).map((f) => ({
    id: `feat-${f.id}`,
    title: f.title,
    overview: f.overview,
    poster_path: f.poster_url,
    stream: f.stream_url,
  }));

  const activeGenreObj = GENRES.find((g) => g.id === selectedGenre);
  const filteredRows = selectedGenre === "all"
    ? rows
    : rows.filter((r) => r.title.toLowerCase().includes(activeGenreObj?.name.toLowerCase() || ""));

  const all = [
    ...(selectedGenre === "all" && featuredItems.length ? [{ title: "Featured on StreamLab", items: featuredItems }] : []),
    ...(selectedGenre === "all" && recent.length ? [{ title: t("continue"), items: recent, resume: true }] : []),
    ...(selectedGenre === "all" && downloads.length ? [{ title: t("downloads"), items: downloads, resume: true }] : []),
    ...(selectedGenre === "all" && lib.length ? [{ title: t("library"), items: lib }] : []),
    ...(selectedGenre === "all" && list.length ? [{ title: t("myList"), items: list }] : []),
    ...(selectedGenre === "all" && showHindiFree && hindiFree.length ? [{ title: "Hindi films, free on Internet Archive", items: hindiFree }] : []),
    ...(filteredRows || []),
    ...(selectedGenre === "all" && free.length ? [{ title: "Free public-domain films", items: free }] : []),
  ];

  return (
    <View style={[styles.wrap, isTV && styles.tvWrap]}>
      {/* Remote Announcement Banner */}
      {remoteConfig?.announcement ? (
        <View style={styles.announcementBar}>
          <Text style={styles.announcementText}>📢 {remoteConfig.announcement}</Text>
        </View>
      ) : null}

      {/* Language Chips */}
      <FlatList
        horizontal
        data={LANGS}
        keyExtractor={(l) => l.code}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}
        renderItem={({ item }) => (
          <Chip lang={item} active={item.code === lang} onPress={() => pick(item.code)} />
        )}
      />

      {/* Genre Filter Chips (REQ-18-02) */}
      <FlatList
        horizontal
        data={GENRES}
        keyExtractor={(g) => String(g.id)}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedGenre(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={[
              styles.genreChip,
              selectedGenre === item.id && styles.genreChipActive,
            ]}
          >
            <Text
              style={[
                styles.genreChipText,
                selectedGenre === item.id && styles.genreChipTextActive,
              ]}
            >
              {item.name}
            </Text>
          </Pressable>
        )}
      />

      {libError && <Text style={[styles.text, { paddingHorizontal: 16, color: "#ffa502" }]}>Library unavailable: {libError}</Text>}
      {error && (
        <View style={styles.errorNotice}>
          <Text style={{ color: "#ff6b8b", fontSize: 14 }}>
            Discovery metadata warning: {error}. Local and archive media remain accessible below.
          </Text>
        </View>
      )}

      {loadingRows && all.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6b8b" />
        </View>
      ) : (
        <FlatList
          data={all}
          keyExtractor={(r) => r.title}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item: row, index: ri }) => (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <FlatList
                horizontal
                data={row.items}
                keyExtractor={(m) => String(m.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                renderItem={({ item, index }) => (
                  <Card item={item} onPress={row.resume ? onResume : onSelect} autoFocus={ri === 0 && index === 0} />
                )}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#10202b" },
  tvWrap: { paddingHorizontal: 48, paddingVertical: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: "#e8f1f5" },
  announcementBar: {
    backgroundColor: "rgba(255,107,139,0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "#ff6b8b",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  announcementText: { color: "#ff6b8b", fontSize: 14, fontWeight: "600", textAlign: "center" },
  errorNotice: {
    backgroundColor: "rgba(255,107,139,0.1)",
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,107,139,0.3)",
  },
  chip: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#2a4557",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "rgba(255,107,139,0.2)", borderColor: "#ff6b8b" },
  chipFocus: { borderColor: "#ffffff", transform: [{ scale: 1.05 }] },
  chipText: { color: "#e8f1f5", fontSize: isTV ? 20 : 15, fontWeight: "600" },
  genreChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#172c3a",
    borderWidth: 1.5,
    borderColor: "#2a4557",
    marginRight: 6,
  },
  genreChipActive: {
    backgroundColor: "rgba(56,239,125,0.15)",
    borderColor: "#38ef7d",
  },
  genreChipText: { color: "#8fa8b6", fontSize: isTV ? 17 : 13, fontWeight: "600" },
  genreChipTextActive: { color: "#38ef7d", fontWeight: "700" },
  rowTitle: {
    color: "#e8f1f5",
    fontSize: isTV ? 24 : 18,
    fontWeight: "700",
    marginLeft: 16,
    marginBottom: 10,
  },
  card: { marginRight: 12, borderRadius: 10, borderWidth: 3, borderColor: "transparent" },
  cardFocused: { borderColor: "#ff6b8b", transform: [{ scale: 1.06 }] },
  poster: { width: W, height: H, borderRadius: 8 },
  placeholder: { backgroundColor: "#172c3a", padding: 8, justifyContent: "center" },
  ph: { color: "#8fa8b6", textAlign: "center", fontSize: 13 },
  track: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: "#ff6b8b" },
});
