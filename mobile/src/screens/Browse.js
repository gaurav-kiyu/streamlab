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
import { loadRows, loadByProvider, img, GENRES, ATTRIBUTION } from "../tmdb";
import { loadRecent, loadList } from "../storage";
import { loadDownloads } from "../downloads";
import { loadLibrary, jellyfinConfigured } from "../jellyfin";
import { loadPublicDomain, loadHindiArchive } from "../archive";
import { fetchRemoteConfig } from "../api";
import { INDIAN_CONTENT_LANGUAGES } from "../languages";
import { INDIAN_PROVIDERS } from "../providers";
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
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {lang.native ? `${lang.native}  ${lang.label}` : lang.label}
      </Text>
    </Pressable>
  );
}

function ProviderChip({ provider, active, onPress }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={provider.name}
      accessibilityState={{ selected: active }}
      style={[styles.providerChip, active && styles.providerChipActive, focused && styles.chipFocus]}
    >
      <Text style={[styles.providerChipText, active && styles.providerChipTextActive]}>
        {provider.name}
      </Text>
    </Pressable>
  );
}

function Card({ item, onPress, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const uri = img(item.poster_path);
  const pct = item.duration ? Math.min(100, (item.position / item.duration) * 100) : 0;
  const isFree = item.archiveId || item.isFree;

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

      {/* Verified Content Badge */}
      {isFree ? (
        <View style={styles.badgeFree}>
          <Text style={styles.badgeFreeText}>FREE</Text>
        </View>
      ) : item.media === "tv" ? (
        <View style={styles.badgeTv}>
          <Text style={styles.badgeTvText}>SERIES</Text>
        </View>
      ) : null}

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
  // Default country: IN, Default content language: All Indian Languages
  const [lang, setLang] = useState(getSettings().lang || "all");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState("all"); // "all" | provider ID | "free"
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

  // Reload the shelves when language or provider filter changes
  useEffect(() => {
    setLoadingRows(true);
    setError(null);

    if (selectedProvider !== "all") {
      if (selectedProvider === "free") {
        loadByProvider(null, "free", lang)
          .then((items) => {
            setRows([{ title: "Free Indian Movies & Content", items }]);
            setLoadingRows(false);
          })
          .catch((e) => {
            setError(e.message);
            setLoadingRows(false);
          });
      } else {
        const provObj = INDIAN_PROVIDERS.find((p) => p.id === selectedProvider);
        const provTmdbId = provObj ? provObj.tmdbId : null;
        loadByProvider(provTmdbId, "all", lang)
          .then((items) => {
            setRows([{ title: `Available on ${provObj?.name || selectedProvider}`, items }]);
            setLoadingRows(false);
          })
          .catch((e) => {
            setError(e.message);
            setLoadingRows(false);
          });
      }
      return;
    }

    loadRows(lang)
      .then((data) => {
        setRows(data);
        setLoadingRows(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoadingRows(false);
      });
  }, [lang, selectedProvider]);

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

  const pickLang = (code) => {
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
    ...(selectedGenre === "all" && selectedProvider === "all" && featuredItems.length ? [{ title: "Featured on StreamLab", items: featuredItems }] : []),
    ...(selectedGenre === "all" && selectedProvider === "all" && recent.length ? [{ title: t("continue"), items: recent, resume: true }] : []),
    ...(selectedGenre === "all" && selectedProvider === "all" && downloads.length ? [{ title: t("downloads"), items: downloads, resume: true }] : []),
    ...(selectedGenre === "all" && selectedProvider === "all" && lib.length ? [{ title: t("library"), items: lib }] : []),
    ...(selectedGenre === "all" && selectedProvider === "all" && list.length ? [{ title: t("myList"), items: list }] : []),
    ...(selectedGenre === "all" && selectedProvider === "all" && showHindiFree && hindiFree.length ? [{ title: "Hindi Classics (Free • Public Domain)", items: hindiFree }] : []),
    ...(filteredRows || []),
    ...(selectedGenre === "all" && selectedProvider === "all" && free.length ? [{ title: "Free Classic Cinema", items: free }] : []),
  ];

  const providerFilterList = [
    { id: "all", name: "All Platforms" },
    { id: "free", name: "Free Legal Content" },
    ...INDIAN_PROVIDERS.filter((p) => !p.isPublicService),
  ];

  return (
    <View style={[styles.wrap, isTV && styles.tvWrap]}>
      {/* Hero Banner: India-First Entertainment Header */}
      <View style={styles.heroBanner}>
        <Text style={styles.heroTitle}>Indian Entertainment</Text>
        <Text style={styles.heroSubtitle}>All Your Languages, All Your Platforms</Text>
      </View>

      {/* Remote Announcement Banner */}
      {remoteConfig?.announcement ? (
        <View style={styles.announcementBar}>
          <Text style={styles.announcementText}>📢 {remoteConfig.announcement}</Text>
        </View>
      ) : null}

      {/* Indian Regional Language Filter Bar */}
      <FlatList
        horizontal
        data={INDIAN_CONTENT_LANGUAGES}
        keyExtractor={(l) => l.code}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6 }}
        renderItem={({ item }) => (
          <Chip lang={item} active={item.code === lang} onPress={() => pickLang(item.code)} />
        )}
      />

      {/* Indian OTT Streaming Provider Filter Bar */}
      <FlatList
        horizontal
        data={providerFilterList}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6 }}
        renderItem={({ item }) => (
          <ProviderChip
            provider={item}
            active={selectedProvider === item.id}
            onPress={() => setSelectedProvider(item.id)}
          />
        )}
      />

      {/* Genre Filter Chips */}
      <FlatList
        horizontal
        data={GENRES}
        keyExtractor={(g) => String(g.id)}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
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
            Discovery metadata advisory: {error}. Local and archive media remain accessible below.
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
          ListFooterComponent={
            <View style={styles.footerAttribution}>
              <Text style={styles.attributionText}>{ATTRIBUTION.tmdb.notice}</Text>
              <Text style={styles.attributionText}>{ATTRIBUTION.justWatch.notice}</Text>
            </View>
          }
          renderItem={({ item: row, index: ri }) => (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <FlatList
                horizontal
                data={row.items}
                keyExtractor={(m) => `${m.id}-${m.media || "mov"}`}
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
  heroBanner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  heroTitle: {
    color: "#ff6b8b",
    fontSize: isTV ? 28 : 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    color: "#8fa8b6",
    fontSize: isTV ? 18 : 13,
    fontWeight: "600",
    marginTop: 2,
  },
  announcementBar: {
    backgroundColor: "rgba(255,107,139,0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "#ff6b8b",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 6,
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
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#2a4557",
    marginRight: 8,
    backgroundColor: "#172c3a",
  },
  chipActive: { backgroundColor: "rgba(255,107,139,0.2)", borderColor: "#ff6b8b" },
  chipFocus: { borderColor: "#ffffff", transform: [{ scale: 1.05 }] },
  chipText: { color: "#8fa8b6", fontSize: isTV ? 19 : 14, fontWeight: "600" },
  chipTextActive: { color: "#ffffff", fontWeight: "700" },
  providerChip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2a4557",
    backgroundColor: "#13232e",
    marginRight: 6,
  },
  providerChipActive: {
    backgroundColor: "rgba(56,239,125,0.15)",
    borderColor: "#38ef7d",
  },
  providerChipText: { color: "#8fa8b6", fontSize: isTV ? 16 : 12, fontWeight: "600" },
  providerChipTextActive: { color: "#38ef7d", fontWeight: "700" },
  genreChip: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#172c3a",
    borderWidth: 1,
    borderColor: "#2a4557",
    marginRight: 6,
  },
  genreChipActive: {
    backgroundColor: "rgba(255,193,7,0.15)",
    borderColor: "#ffc107",
  },
  genreChipText: { color: "#8fa8b6", fontSize: isTV ? 15 : 12, fontWeight: "600" },
  genreChipTextActive: { color: "#ffc107", fontWeight: "700" },
  rowTitle: {
    color: "#e8f1f5",
    fontSize: isTV ? 24 : 18,
    fontWeight: "700",
    marginLeft: 16,
    marginBottom: 10,
  },
  card: { marginRight: 12, borderRadius: 10, borderWidth: 3, borderColor: "transparent", position: "relative" },
  cardFocused: { borderColor: "#ff6b8b", transform: [{ scale: 1.06 }] },
  poster: { width: W, height: H, borderRadius: 8 },
  placeholder: { backgroundColor: "#172c3a", padding: 8, justifyContent: "center" },
  ph: { color: "#8fa8b6", textAlign: "center", fontSize: 13 },
  badgeFree: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#2ed573",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeFreeText: { color: "#10202b", fontSize: 10, fontWeight: "800" },
  badgeTv: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#1e90ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeTvText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
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
  footerAttribution: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
  attributionText: {
    color: "#6c8494",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 4,
  },
});
