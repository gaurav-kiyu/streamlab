import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Linking,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { loadList, toggleList } from "../storage";
import { getProviders, getMovieDetails, getSimilarMovies, img, backdropImg } from "../tmdb";
import { loadDownloads, startDownload, removeDownload } from "../downloads";
import { syncCloudWatchlistToggle } from "../api";
import { useT } from "../i18n";

const isTV = Platform.isTV;

function Btn({ label, onPress, autoFocus, primary, disabled, variant }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={autoFocus}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.btn,
        primary && styles.primaryBtn,
        variant === "secondary" && styles.secondaryBtn,
        focused && styles.focusedBtn,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.btnText, primary && styles.primaryBtnText]}>{label}</Text>
    </Pressable>
  );
}

const line = (label, arr) =>
  arr && arr.length ? (
    <Text style={styles.provItem}>
      <Text style={styles.provLabel}>{label}: </Text>
      {arr.join(", ")}
    </Text>
  ) : null;

const same = (a, b) => String(a) === String(b);

export default function Details({ item, onPlay, onBack, getDownloadUrl }) {
  const t = useT();
  const [inList, setInList] = useState(false);
  const [details, setDetails] = useState(null);
  const [prov, setProv] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dl, setDl] = useState({ state: "idle", pct: 0 });

  // Source classification
  const isJellyfin = !!item.stream && !item.archiveId;
  const isArchive = !!item.archiveId;
  const isPlayable = isJellyfin || isArchive || !!item.stream;
  const canDownload = isArchive || !!item.download;

  useEffect(() => {
    let active = true;
    Promise.all([
      loadList().then((l) => l.some((m) => same(m.id, item.id))),
      getProviders(item).catch(() => null),
      getMovieDetails(item).catch(() => null),
      getSimilarMovies(item).catch(() => []),
      loadDownloads().then((l) => l.some((d) => same(d.id, item.id))),
    ]).then(([inWatchlist, providers, movieDetails, similarMovies, isDownloaded]) => {
      if (!active) return;
      setInList(inWatchlist);
      setProv(providers);
      setDetails(movieDetails);
      setSimilar(similarMovies || []);
      if (isDownloaded) setDl({ state: "done", pct: 100 });
      setLoading(false);
    });

    return () => { active = false; };
  }, [item.id]);

  const onToggleList = async () => {
    const nextState = await toggleList(item);
    setInList(nextState);
    syncCloudWatchlistToggle(item);
  };

  const onDownload = async () => {
    if (dl.state === "downloading") return;
    if (dl.state === "done") {
      await removeDownload(item.id);
      setDl({ state: "idle", pct: 0 });
      return;
    }
    setDl({ state: "downloading", pct: 0 });
    try {
      const url = await getDownloadUrl();
      if (!url) throw new Error("No download URL");
      await startDownload(item, url, (f) =>
        setDl({ state: "downloading", pct: Math.round(f * 100) })
      );
      setDl({ state: "done", pct: 100 });
    } catch {
      setDl({ state: "idle", pct: 0 });
    }
  };

  const backdropUri = backdropImg(details?.backdrop_path || item.backdrop_path);
  const posterUri = img(details?.poster_path || item.poster_path, "w342");
  const releaseYear = (details?.release_date || item.release_date || "").slice(0, 4);
  const runtimeMin = details?.runtime;
  const runtimeFormatted = runtimeMin ? `${Math.floor(runtimeMin / 60)}h ${runtimeMin % 60}m` : null;
  const ratingScore = details?.vote_average ? `★ ${details.vote_average.toFixed(1)}/10` : null;
  const genresList = (details?.genres || []).map((g) => g.name).join(" · ");
  const castList = (details?.credits?.cast || []).slice(0, 5).map((c) => c.name).join(", ");

  const dlLabel =
    dl.state === "done"
      ? t("removeDownload")
      : dl.state === "downloading"
      ? `${t("downloading")} ${dl.pct}%`
      : t("download");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero Backdrop Banner */}
      {backdropUri && (
        <View style={styles.backdropWrap}>
          <Image source={{ uri: backdropUri }} style={styles.backdrop} resizeMode="cover" />
          <View style={styles.backdropFade} />
        </View>
      )}

      <View style={styles.contentWrap}>
        {/* Source Badge */}
        <View style={styles.badgeRow}>
          {isJellyfin && <Text style={[styles.sourceBadge, styles.badgeJf]}>Personal Library · Jellyfin</Text>}
          {isArchive && <Text style={[styles.sourceBadge, styles.badgeArchive]}>Public Domain · Internet Archive</Text>}
          {!isJellyfin && !isArchive && <Text style={[styles.sourceBadge, styles.badgeTmdb]}>OTT Discovery · TMDB</Text>}
          {dl.state === "done" && <Text style={[styles.sourceBadge, styles.badgeDownloaded]}>Downloaded Offline</Text>}
        </View>

        <View style={styles.mainInfo}>
          {posterUri && <Image source={{ uri: posterUri }} style={styles.poster} />}
          <View style={styles.titleInfo}>
            <Text style={styles.title}>{item.title}</Text>
            
            {/* Meta Row: Year, Runtime, Rating */}
            <View style={styles.metaRow}>
              {releaseYear ? <Text style={styles.metaText}>{releaseYear}</Text> : null}
              {runtimeFormatted ? <Text style={styles.metaText}>• {runtimeFormatted}</Text> : null}
              {ratingScore ? <Text style={[styles.metaText, styles.ratingText]}>• {ratingScore}</Text> : null}
            </View>

            {genresList ? <Text style={styles.genresText}>{genresList}</Text> : null}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          {isPlayable || dl.state === "done" ? (
            <Btn primary autoFocus label="▶  Play Now" onPress={onPlay} />
          ) : (
            <Btn
              autoFocus
              variant="secondary"
              label="Check Where to Watch in India"
              onPress={() => {
                if (prov?.link) Linking.openURL(prov.link);
              }}
            />
          )}

          {canDownload && <Btn label={dlLabel} onPress={onDownload} />}
          <Btn label={inList ? `✓ ${t("removeList")}` : `+ ${t("addList")}`} onPress={onToggleList} />
          <Btn label={t("back")} onPress={onBack} />
        </View>

        {/* Synopsis / Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.body}>{details?.overview || item.overview || t("noDesc")}</Text>
        </View>

        {/* Cast & Crew */}
        {castList ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Starring</Text>
            <Text style={styles.body}>{castList}</Text>
          </View>
        ) : null}

        {/* More Like This / Recommendations Shelf (REQ-18-03) */}
        {similar && similar.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More Like This</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
              {similar.map((sim) => {
                const simPoster = img(sim.poster_path, "w185");
                return (
                  <Pressable
                    key={sim.id}
                    onPress={() => (onPlay ? onPlay(sim) : null)}
                    style={styles.similarCard}
                    accessibilityRole="button"
                    accessibilityLabel={sim.title}
                  >
                    {simPoster ? (
                      <Image source={{ uri: simPoster }} style={styles.similarPoster} />
                    ) : (
                      <View style={[styles.similarPoster, styles.placeholder]}>
                        <Text style={{ color: "#8fa8b6", fontSize: 11, textAlign: "center" }}>{sim.title}</Text>
                      </View>
                    )}
                    <Text style={styles.similarTitle} numberOfLines={1}>{sim.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Where to Watch in India (JustWatch) */}
        {prov && (
          <View style={styles.provSection}>
            <Text style={styles.provTitle}>{t("whereIndia")}</Text>
            {line(t("free"), prov.free)}
            {line(t("subscription"), prov.subscription)}
            {line(t("rent"), prov.rent)}
            {!prov.free.length && !prov.subscription.length && !prov.rent.length && (
              <Text style={styles.provItem}>{t("noListings")}</Text>
            )}
            {prov.link && (
              <Pressable
                style={styles.ottLinkBtn}
                onPress={() => Linking.openURL(prov.link)}
                accessibilityRole="link"
              >
                <Text style={styles.ottLinkText}>Open JustWatch India Listings ↗</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#10202b", flexGrow: 1, paddingBottom: 48 },
  backdropWrap: { width: "100%", height: isTV ? 380 : 220, position: "relative" },
  backdrop: { width: "100%", height: "100%" },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,32,43,0.45)",
  },
  contentWrap: { padding: isTV ? 40 : 20, marginTop: -30 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  sourceBadge: {
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    overflow: "hidden",
  },
  badgeJf: { backgroundColor: "#1e384b", color: "#38ef7d", borderWidth: 1, borderColor: "#38ef7d" },
  badgeArchive: { backgroundColor: "#1e384b", color: "#ffa502", borderWidth: 1, borderColor: "#ffa502" },
  badgeTmdb: { backgroundColor: "#1e384b", color: "#ff6b8b", borderWidth: 1, borderColor: "#ff6b8b" },
  badgeDownloaded: { backgroundColor: "#38ef7d", color: "#10202b" },
  mainInfo: { flexDirection: "row", gap: 18, marginBottom: 20 },
  poster: { width: isTV ? 160 : 110, height: isTV ? 240 : 165, borderRadius: 10 },
  titleInfo: { flex: 1, justifyContent: "center" },
  title: { color: "#e8f1f5", fontSize: isTV ? 34 : 24, fontWeight: "800", marginBottom: 8 },
  metaRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  metaText: { color: "#8fa8b6", fontSize: isTV ? 17 : 14, fontWeight: "600" },
  ratingText: { color: "#ffc107" },
  genresText: { color: "#8fa8b6", fontSize: isTV ? 16 : 13, marginTop: 4 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginVertical: 18 },
  btn: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2a4557",
    backgroundColor: "#172c3a",
  },
  primaryBtn: { backgroundColor: "#ff6b8b", borderColor: "#ff6b8b" },
  primaryBtnText: { color: "#10202b", fontWeight: "800" },
  secondaryBtn: { backgroundColor: "#1e384b", borderColor: "#ff6b8b" },
  focusedBtn: { borderColor: "#ffffff", transform: [{ scale: 1.04 }] },
  btnText: { color: "#e8f1f5", fontSize: 16, fontWeight: "600" },
  section: { marginTop: 18 },
  sectionTitle: { color: "#e8f1f5", fontSize: isTV ? 22 : 18, fontWeight: "700", marginBottom: 6 },
  body: { color: "#8fa8b6", fontSize: isTV ? 18 : 15, lineHeight: 24 },
  provSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#172c3a",
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  provTitle: { color: "#e8f1f5", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  provItem: { color: "#8fa8b6", fontSize: 15, marginBottom: 4 },
  provLabel: { color: "#e8f1f5", fontWeight: "600" },
  similarCard: { width: isTV ? 140 : 105, marginRight: 12 },
  similarPoster: { width: isTV ? 140 : 105, height: isTV ? 210 : 155, borderRadius: 8 },
  similarTitle: { color: "#e8f1f5", fontSize: isTV ? 15 : 12, marginTop: 4, fontWeight: "600" },
  placeholder: { backgroundColor: "#172c3a", justifyContent: "center", alignItems: "center", padding: 6 },
  ottLinkBtn: { marginTop: 10, alignSelf: "flex-start" },
  ottLinkText: { color: "#ff6b8b", fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
});
