import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import Video from "react-native-video";
import {
  fetchLiveTvChannels,
  fetchLiveTvProviders,
  createLiveTvProvider,
  deleteLiveTvProvider,
  importLiveTvPlaylist,
  toggleLiveTvFavorite,
  recordLiveTvHistory,
  fetchLiveTvRecent,
  fetchChannelCurrentProgram,
  fetchEpgGuide,
  importEpg,
} from "../api.js";
import { getSettings } from "../settings.js";
import { useT } from "../i18n.js";

const isTV = Platform.isTV;

function formatProgramTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch {
    return "";
  }
}

function calculateProgress(startUtc, stopUtc) {
  if (!startUtc || !stopUtc) return 0;
  const start = new Date(startUtc).getTime();
  const stop = new Date(stopUtc).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= stop) return 100;
  const total = stop - start;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
}

function calculateMinutesLeft(stopUtc) {
  if (!stopUtc) return null;
  const stop = new Date(stopUtc).getTime();
  const diff = stop - Date.now();
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
}

export default function LiveTV({ onSelectChannel }) {
  const t = useT();
  const [channels, setChannels] = useState([]);
  const [recent, setRecent] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("playlist"); // "playlist" | "epg"

  // EPG & View State
  const [viewMode, setViewMode] = useState(isTV ? "grid" : "list"); // "list" | "grid"
  const [channelEpg, setChannelEpg] = useState({}); // channelId -> { now, next }
  const [guideData, setGuideData] = useState([]);
  const [focusedChannelId, setFocusedChannelId] = useState(null);

  // Picture-in-Guide / Mini-Player State
  const [miniPlayerChannel, setMiniPlayerChannel] = useState(null);
  const [miniPlayerMuted, setMiniPlayerMuted] = useState(false);
  const [miniPlayerError, setMiniPlayerError] = useState(false);

  // Import Playlist Form State
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [rawM3u, setRawM3u] = useState("");
  const [rightsAcknowledged, setRightsAcknowledged] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // Import EPG Form State
  const [epgProviderId, setEpgProviderId] = useState("");
  const [epgUrl, setEpgUrl] = useState("");
  const [rawXml, setRawXml] = useState("");
  const [epgRightsAcknowledged, setEpgRightsAcknowledged] = useState(false);
  const [importingEpg, setImportingEpg] = useState(false);
  const [epgError, setEpgError] = useState("");

  const settings = getSettings();
  const profileId = settings.activeProfile?.id || null;

  useEffect(() => {
    loadData();
  }, [profileId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chData, provData, recData] = await Promise.all([
        fetchLiveTvChannels(profileId),
        fetchLiveTvProviders(profileId).catch(() => ({ providers: [] })),
        fetchLiveTvRecent(profileId, 5).catch(() => ({ recent: [] })),
      ]);
      const fetchedChannels = chData?.channels || [];
      setChannels(fetchedChannels);
      setProviders(provData?.providers || []);
      setRecent(recData?.recent || []);

      if (fetchedChannels.length > 0) {
        loadEpgForChannels(fetchedChannels);
      }
    } catch (e) {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const loadEpgForChannels = async (channelList) => {
    try {
      const guideRes = await fetchEpgGuide(profileId, 4).catch(() => null);
      if (guideRes?.guide && Array.isArray(guideRes.guide)) {
        setGuideData(guideRes.guide);
        const epgMap = {};
        for (const entry of guideRes.guide) {
          const progs = entry.programs || [];
          const nowProg = progs[0] || null;
          const nextProg = progs[1] || null;
          epgMap[entry.id] = { now: nowProg, next: nextProg };
        }
        setChannelEpg(epgMap);
      } else {
        // Fallback: batch fetch current program for first 15 channels
        const topChannels = channelList.slice(0, 15);
        const promises = topChannels.map((c) =>
          fetchChannelCurrentProgram(c.id).catch(() => null)
        );
        const results = await Promise.all(promises);
        const epgMap = {};
        results.forEach((res, i) => {
          if (res && topChannels[i]) {
            epgMap[topChannels[i].id] = { now: res.now, next: res.next };
          }
        });
        setChannelEpg(epgMap);
      }
    } catch {
      // EPG load failure gracefully defaults to Program Information Unavailable
    }
  };

  const handleToggleFavorite = async (channelId) => {
    try {
      const res = await toggleLiveTvFavorite(channelId, profileId);
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, is_favorite: res.isFavorite ? 1 : 0 } : c))
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handlePlayChannel = async (channel, fullscreen = true) => {
    try {
      await recordLiveTvHistory(channel.id, profileId, 0);
    } catch {}

    if (fullscreen) {
      if (onSelectChannel) {
        onSelectChannel({
          id: channel.id,
          title: channel.name,
          stream: channel.stream_url,
          isLive: true,
          logo: channel.logo_url,
        });
      }
    } else {
      // Picture-in-Guide / Mini-Player Preview
      setMiniPlayerError(false);
      setMiniPlayerChannel(channel);
    }
  };

  const handleImport = async () => {
    if (!providerName.trim()) {
      setImportError("Please provide a name for this provider.");
      return;
    }
    if (!providerUrl.trim() && !rawM3u.trim()) {
      setImportError("Please provide an M3U URL or paste M3U playlist text.");
      return;
    }
    if (!rightsAcknowledged) {
      setImportError("You must acknowledge that you have lawful rights to access these streams.");
      return;
    }

    setImporting(true);
    setImportError("");

    try {
      const provRes = await createLiveTvProvider({
        name: providerName.trim(),
        type: "playlist",
        url: providerUrl.trim() || null,
        profileId,
        rightsAcknowledged: true,
      });

      const providerId = provRes.provider.id;

      const importRes = await importLiveTvPlaylist({
        providerId,
        profileId,
        url: providerUrl.trim() || null,
        content: rawM3u.trim() || null,
        rightsAcknowledged: true,
      });

      Alert.alert(
        "Import Successful",
        `Successfully imported ${importRes.channelsImported} channels into Live TV.`
      );

      setProviderName("");
      setProviderUrl("");
      setRawM3u("");
      setRightsAcknowledged(false);
      setShowModal(false);
      loadData();
    } catch (e) {
      setImportError(e.message || "Failed to import playlist.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportEpg = async () => {
    if (!epgUrl.trim() && !rawXml.trim()) {
      setEpgError("Please enter an XMLTV URL or paste XMLTV data.");
      return;
    }
    if (!epgRightsAcknowledged) {
      setEpgError("You must acknowledge lawful authorization to import this guide data.");
      return;
    }

    setImportingEpg(true);
    setEpgError("");

    try {
      const res = await importEpg({
        providerId: epgProviderId || null,
        url: epgUrl.trim() || null,
        content: rawXml.trim() || null,
        rightsAcknowledged: true,
      });

      Alert.alert(
        "EPG Ingestion Complete",
        `Imported ${res.programsImported || 0} programmes across ${res.channelsMatched || 0} channels.`
      );

      setEpgUrl("");
      setRawXml("");
      setEpgRightsAcknowledged(false);
      setShowModal(false);
      loadData();
    } catch (e) {
      setEpgError(e.message || "Failed to import EPG data.");
    } finally {
      setImportingEpg(false);
    }
  };

  const handleDeleteProvider = async (providerId) => {
    Alert.alert(
      "Remove Provider",
      "Are you sure you want to remove this provider and all its channels?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteLiveTvProvider(providerId);
              loadData();
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  // Derive categories
  const categories = useMemo(() => {
    const set = new Set(["All", "Favorites"]);
    channels.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [channels]);

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (selectedCategory === "Favorites" && !c.is_favorite) return false;
      if (selectedCategory !== "All" && selectedCategory !== "Favorites" && c.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.category && c.category.toLowerCase().includes(q));
      }
      return true;
    });
  }, [channels, selectedCategory, searchQuery]);

  // Compute Time Grid Slots for 10-Foot EPG
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    // Round down to previous 30 min mark
    const baseMinutes = now.getMinutes() >= 30 ? 30 : 0;
    const baseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), baseMinutes, 0);

    for (let i = 0; i < 4; i++) {
      const slotTime = new Date(baseTime.getTime() + i * 30 * 60000);
      let h = slotTime.getHours();
      const m = String(slotTime.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      slots.push(`${h}:${m} ${ampm}`);
    }
    return slots;
  }, []);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live TV & Guide</Text>
          <Text style={styles.subtitle}>{channels.length} Channels • Electronic Program Guide</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* View Mode Toggle */}
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
            onPress={() => setViewMode("list")}
            accessibilityLabel="List View"
          >
            <Text style={[styles.viewToggleText, viewMode === "list" && styles.viewToggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "grid" && styles.viewToggleBtnActive, { marginRight: 10 }]}
            onPress={() => setViewMode("grid")}
            accessibilityLabel="TV Guide View"
          >
            <Text style={[styles.viewToggleText, viewMode === "grid" && styles.viewToggleTextActive]}>Guide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => setShowModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Manage Providers and EPG"
          >
            <Text style={styles.manageButtonText}>+ Sources / EPG</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Picture-in-Guide / Mini-Player Pane */}
      {miniPlayerChannel && (
        <View style={styles.miniPlayerContainer}>
          <View style={styles.miniPlayerVideoBox}>
            {miniPlayerError ? (
              <View style={styles.miniPlayerErrorBox}>
                <Text style={{ color: "#ff6b8b", fontSize: 13, fontWeight: "600" }}>Stream unavailable in preview</Text>
              </View>
            ) : (
              <Video
                source={{ uri: miniPlayerChannel.stream_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                muted={miniPlayerMuted}
                onError={() => setMiniPlayerError(true)}
                repeat={true}
              />
            )}
            <View style={styles.miniPlayerLiveBadge}>
              <Text style={styles.liveTagText}>🔴 LIVE PREVIEW</Text>
            </View>
          </View>
          <View style={styles.miniPlayerDetails}>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniPlayerTitle} numberOfLines={1}>{miniPlayerChannel.name}</Text>
              <Text style={styles.miniPlayerSub} numberOfLines={1}>
                {channelEpg[miniPlayerChannel.id]?.now?.title || "Program Information Unavailable"}
              </Text>
            </View>
            <View style={styles.miniPlayerActions}>
              <TouchableOpacity
                style={styles.miniPlayerBtn}
                onPress={() => setMiniPlayerMuted(!miniPlayerMuted)}
              >
                <Text style={styles.miniPlayerBtnText}>{miniPlayerMuted ? "🔇" : "🔊"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniPlayerBtn, styles.miniPlayerFullscreenBtn]}
                onPress={() => handlePlayChannel(miniPlayerChannel, true)}
              >
                <Text style={styles.miniPlayerFullscreenText}>⛶ Fullscreen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.miniPlayerBtn}
                onPress={() => setMiniPlayerChannel(null)}
              >
                <Text style={styles.miniPlayerBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search channels, categories, or programmes..."
          placeholderTextColor="#8fa8b6"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text style={{ color: "#ff6b8b", fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categories Row */}
      {categories.length > 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                {cat === "Favorites" ? "★ Favorites" : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Recently Watched Rail */}
      {recent.length > 0 && selectedCategory === "All" && !searchQuery && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionHeader}>Recently Watched</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {recent.map((ch) => (
              <TouchableOpacity
                key={ch.id}
                style={styles.recentCard}
                onPress={() => handlePlayChannel(ch, true)}
                onLongPress={() => handlePlayChannel(ch, false)}
              >
                <View style={styles.recentLogoContainer}>
                  {ch.logo_url ? (
                    <Image source={{ uri: ch.logo_url }} style={styles.recentLogo} resizeMode="contain" />
                  ) : (
                    <Text style={styles.channelNumberText}>#{ch.channel_number || "?"}</Text>
                  )}
                </View>
                <Text style={styles.recentTitle} numberOfLines={1}>{ch.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main View: List or TV 10-Foot Guide */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6b8b" />
          <Text style={styles.loadingText}>Loading Live TV and EPG schedule...</Text>
        </View>
      ) : filteredChannels.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>📺</Text>
          <Text style={styles.emptyTitle}>No Channels Found</Text>
          <Text style={styles.emptySub}>
            {searchQuery
              ? "No channels match your search query."
              : "Import an M3U playlist and XMLTV guide to start watching live channels."}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.addCta} onPress={() => setShowModal(true)}>
              <Text style={styles.addCtaText}>+ Import M3U & EPG</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : viewMode === "grid" ? (
        /* 10-Foot TV EPG Timeline Grid */
        <View style={styles.gridContainer}>
          {/* Time Slot Header Row */}
          <View style={styles.timeHeaderRow}>
            <View style={styles.gridChannelColumnHeader}>
              <Text style={styles.gridHeaderChannelText}>Channel</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: "row" }}>
                {timeSlots.map((slot, index) => (
                  <View key={index} style={styles.timeSlotBox}>
                    <Text style={styles.timeSlotText}>{slot}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Channels & Programme Timeline */}
          <FlatList
            data={filteredChannels}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const epg = channelEpg[item.id];
              const nowProg = epg?.now;
              const nextProg = epg?.next;
              const isFocused = focusedChannelId === item.id;

              return (
                <View style={[styles.gridRow, isFocused && styles.gridRowFocused]}>
                  {/* Left Column: Channel Info */}
                  <TouchableOpacity
                    style={styles.gridChannelBox}
                    onPress={() => handlePlayChannel(item, true)}
                    onLongPress={() => handlePlayChannel(item, false)}
                    focusable={true}
                    onFocus={() => setFocusedChannelId(item.id)}
                  >
                    <View style={styles.gridChannelLogo}>
                      {item.logo_url ? (
                        <Image source={{ uri: item.logo_url }} style={styles.channelLogoSmall} resizeMode="contain" />
                      ) : (
                        <Text style={styles.channelNoBadgeSmall}>{item.channel_number || "—"}</Text>
                      )}
                    </View>
                    <Text style={styles.gridChannelName} numberOfLines={1}>{item.name}</Text>
                  </TouchableOpacity>

                  {/* Horizontal Programme Blocks */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {/* Current Programme Block */}
                      <TouchableOpacity
                        style={[styles.programBlock, styles.programBlockCurrent]}
                        onPress={() => handlePlayChannel(item, true)}
                        focusable={true}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={styles.programTitle} numberOfLines={1}>
                            {nowProg?.title || "Program Information Unavailable"}
                          </Text>
                          {nowProg?.start_time && (
                            <Text style={styles.programTime}>
                              {formatProgramTime(nowProg.start_time)} - {formatProgramTime(nowProg.end_time)}
                            </Text>
                          )}
                        </View>
                        {nowProg?.start_time && (
                          <View style={styles.progressBarBg}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${calculateProgress(nowProg.start_time, nowProg.end_time)}%` },
                              ]}
                            />
                          </View>
                        )}
                        {nowProg?.description ? (
                          <Text style={styles.programDesc} numberOfLines={1}>{nowProg.description}</Text>
                        ) : null}
                      </TouchableOpacity>

                      {/* Next Programme Block */}
                      <TouchableOpacity
                        style={[styles.programBlock, styles.programBlockNext]}
                        onPress={() => handlePlayChannel(item, true)}
                        focusable={true}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={styles.programTitleNext} numberOfLines={1}>
                            {nextProg?.title || "Upcoming programming"}
                          </Text>
                          {nextProg?.start_time && (
                            <Text style={styles.programTimeNext}>
                              {formatProgramTime(nextProg.start_time)}
                            </Text>
                          )}
                        </View>
                        {nextProg?.description ? (
                          <Text style={styles.programDescNext} numberOfLines={1}>{nextProg.description}</Text>
                        ) : null}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              );
            }}
          />
        </View>
      ) : (
        /* Standard Mobile / Touch List View */
        <FlatList
          data={filteredChannels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const epg = channelEpg[item.id];
            const nowProg = epg?.now;
            const nextProg = epg?.next;
            const progress = nowProg ? calculateProgress(nowProg.start_time, nowProg.end_time) : 0;
            const minsLeft = nowProg ? calculateMinutesLeft(nowProg.end_time) : null;

            return (
              <TouchableOpacity
                style={styles.channelRow}
                onPress={() => handlePlayChannel(item, true)}
                onLongPress={() => handlePlayChannel(item, false)}
              >
                {/* Channel Number / Logo */}
                <View style={styles.logoBox}>
                  {item.logo_url ? (
                    <Image source={{ uri: item.logo_url }} style={styles.channelLogo} resizeMode="contain" />
                  ) : (
                    <Text style={styles.channelNoBadge}>{item.channel_number || "—"}</Text>
                  )}
                </View>

                {/* Channel Information & Inline EPG */}
                <View style={styles.channelInfo}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <Text style={styles.channelName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.liveTag}>
                        <Text style={styles.liveTagText}>LIVE</Text>
                      </View>
                    </View>
                    <Text style={styles.channelCategory}>{item.category || "General"}</Text>
                  </View>

                  {/* EPG Current Programme */}
                  <View style={styles.epgContainer}>
                    <View style={styles.epgNowRow}>
                      <Text style={styles.epgNowTitle} numberOfLines={1}>
                        {nowProg?.title || "Program Information Unavailable"}
                      </Text>
                      {minsLeft !== null && (
                        <Text style={styles.epgRemaining}>{minsLeft}m left</Text>
                      )}
                    </View>

                    {nowProg?.start_time && (
                      <View style={styles.epgProgressContainer}>
                        <View style={[styles.epgProgressBar, { width: `${progress}%` }]} />
                      </View>
                    )}

                    {nextProg && (
                      <Text style={styles.epgNextTitle} numberOfLines={1}>
                        Next: {nextProg.title} {nextProg.start_time ? `(${formatProgramTime(nextProg.start_time)})` : ""}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Action Buttons: Preview & Favorite */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() => handlePlayChannel(item, false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Preview in Picture-in-Guide"
                  >
                    <Text style={{ fontSize: 16 }}>👁️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.favButton}
                    onPress={() => handleToggleFavorite(item.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={{ fontSize: 20, color: item.is_favorite ? "#ffcc00" : "#8fa8b6" }}>
                      {item.is_favorite ? "★" : "☆"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Sources & EPG Modal */}
      <Modal visible={showModal} animationType="slide" transparent={false} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sources & Program Guide</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.closeBtn}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Modal Tabs */}
          <View style={styles.modalTabsRow}>
            <TouchableOpacity
              style={[styles.modalTab, activeModalTab === "playlist" && styles.modalTabActive]}
              onPress={() => setActiveModalTab("playlist")}
            >
              <Text style={[styles.modalTabText, activeModalTab === "playlist" && styles.modalTabTextActive]}>
                M3U Playlists
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, activeModalTab === "epg" && styles.modalTabActive]}
              onPress={() => setActiveModalTab("epg")}
            >
              <Text style={[styles.modalTabText, activeModalTab === "epg" && styles.modalTabTextActive]}>
                XMLTV / EPG
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            {activeModalTab === "playlist" ? (
              /* M3U Playlist Tab */
              <>
                {providers.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={styles.formSectionHeader}>Configured Providers</Text>
                    {providers.map((p) => (
                      <View key={p.id} style={styles.providerRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.providerName}>{p.name}</Text>
                          <Text style={styles.providerMeta} numberOfLines={1}>
                            {p.type.toUpperCase()} • {p.url || "Inline M3U"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleDeleteProvider(p.id)}
                        >
                          <Text style={{ color: "#ff4d6d", fontWeight: "600" }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.formSectionHeader}>Import M3U Playlist</Text>

                <Text style={styles.inputLabel}>Provider / Network Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. DD Free Dish / Legal Cable"
                  placeholderTextColor="#8fa8b6"
                  value={providerName}
                  onChangeText={setProviderName}
                />

                <Text style={styles.inputLabel}>M3U Playlist URL</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://example.com/playlist.m3u8"
                  placeholderTextColor="#8fa8b6"
                  value={providerUrl}
                  onChangeText={setProviderUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.inputLabel}>OR Paste M3U Raw Text</Text>
                <TextInput
                  style={[styles.textInput, { height: 90, textAlignVertical: "top" }]}
                  placeholder="#EXTM3U&#10;#EXTINF:-1,Channel 1&#10;https://..."
                  placeholderTextColor="#8fa8b6"
                  value={rawM3u}
                  onChangeText={setRawM3u}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Rights Acknowledgement (MANDATORY) */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setRightsAcknowledged(!rightsAcknowledged)}
                >
                  <View style={[styles.checkbox, rightsAcknowledged && styles.checkboxActive]}>
                    {rightsAcknowledged && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    I certify that I hold the legal right, authorization, or subscription to access these streams. StreamLab does not provide, host, or index user streams.
                  </Text>
                </TouchableOpacity>

                {importError ? <Text style={styles.errorText}>{importError}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitButton, (!rightsAcknowledged || importing) && styles.submitButtonDisabled]}
                  onPress={handleImport}
                  disabled={!rightsAcknowledged || importing}
                >
                  {importing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Import & Sync Channels</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              /* XMLTV / EPG Tab */
              <>
                <Text style={styles.formSectionHeader}>Import XMLTV Program Guide</Text>
                <Text style={styles.guideHelpText}>
                  Synchronize electronic program guide data across your channels using standard XMLTV format. Timestamps are automatically normalized to UTC.
                </Text>

                <Text style={styles.inputLabel}>Select Linked Provider (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.providerSelectChip, !epgProviderId && styles.providerSelectChipActive]}
                    onPress={() => setEpgProviderId("")}
                  >
                    <Text style={[styles.providerSelectText, !epgProviderId && styles.providerSelectTextActive]}>
                      All Providers
                    </Text>
                  </TouchableOpacity>
                  {providers.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.providerSelectChip, epgProviderId === p.id && styles.providerSelectChipActive]}
                      onPress={() => setEpgProviderId(p.id)}
                    >
                      <Text style={[styles.providerSelectText, epgProviderId === p.id && styles.providerSelectTextActive]}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>XMLTV Guide URL (.xml / .xml.gz)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://example.com/epg.xml"
                  placeholderTextColor="#8fa8b6"
                  value={epgUrl}
                  onChangeText={setEpgUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.inputLabel}>OR Paste XMLTV XML Data</Text>
                <TextInput
                  style={[styles.textInput, { height: 100, textAlignVertical: "top" }]}
                  placeholder="<?xml version='1.0' encoding='UTF-8'?>&#10;<tv>&#10;  <channel id='ch1'>...</channel>&#10;</tv>"
                  placeholderTextColor="#8fa8b6"
                  value={rawXml}
                  onChangeText={setRawXml}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setEpgRightsAcknowledged(!epgRightsAcknowledged)}
                >
                  <View style={[styles.checkbox, epgRightsAcknowledged && styles.checkboxActive]}>
                    {epgRightsAcknowledged && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    I certify that this XMLTV guide is lawfully obtained for personal programming navigation.
                  </Text>
                </TouchableOpacity>

                {epgError ? <Text style={styles.errorText}>{epgError}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitButton, (!epgRightsAcknowledged || importingEpg) && styles.submitButtonDisabled]}
                  onPress={handleImportEpg}
                  disabled={!epgRightsAcknowledged || importingEpg}
                >
                  {importingEpg ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Ingest & Sync EPG</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#10202b" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: isTV ? 28 : 22, fontWeight: "800", color: "#e8f1f5" },
  subtitle: { fontSize: 13, color: "#8fa8b6", marginTop: 2 },
  viewToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#172c3a",
    borderRadius: 6,
    marginRight: 4,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  viewToggleBtnActive: { backgroundColor: "#ff6b8b", borderColor: "#ff6b8b" },
  viewToggleText: { color: "#8fa8b6", fontSize: 12, fontWeight: "700" },
  viewToggleTextActive: { color: "#fff" },
  manageButton: {
    backgroundColor: "#203a4c",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ff6b8b",
  },
  manageButtonText: { color: "#ff6b8b", fontWeight: "700", fontSize: 12 },

  // Mini-Player / Picture-in-Guide
  miniPlayerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: "#0d1b24",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ff6b8b",
  },
  miniPlayerVideoBox: {
    width: "100%",
    height: 180,
    backgroundColor: "#000",
    position: "relative",
  },
  miniPlayerErrorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  miniPlayerLiveBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 77, 109, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  miniPlayerDetails: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#172c3a",
  },
  miniPlayerTitle: { color: "#e8f1f5", fontSize: 14, fontWeight: "700" },
  miniPlayerSub: { color: "#8fa8b6", fontSize: 12, marginTop: 2 },
  miniPlayerActions: { flexDirection: "row", alignItems: "center" },
  miniPlayerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#203a4c",
    borderRadius: 6,
    marginLeft: 6,
  },
  miniPlayerBtnText: { color: "#e8f1f5", fontSize: 12, fontWeight: "700" },
  miniPlayerFullscreenBtn: { backgroundColor: "#ff6b8b" },
  miniPlayerFullscreenText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#172c3a",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  searchInput: { flex: 1, height: 40, color: "#e8f1f5", fontSize: 14 },
  categoryScroll: { marginVertical: 4 },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#172c3a",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  categoryChipActive: { backgroundColor: "#ff6b8b", borderColor: "#ff6b8b" },
  categoryText: { color: "#8fa8b6", fontSize: 13, fontWeight: "600" },
  categoryTextActive: { color: "#fff", fontWeight: "700" },

  recentSection: { marginTop: 6, marginBottom: 10 },
  sectionHeader: { fontSize: 14, fontWeight: "700", color: "#e8f1f5", marginLeft: 16, marginBottom: 8 },
  recentCard: {
    width: 90,
    marginRight: 10,
    alignItems: "center",
    backgroundColor: "#172c3a",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  recentLogoContainer: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  recentLogo: { width: 40, height: 40 },
  recentTitle: { color: "#e8f1f5", fontSize: 11, marginTop: 4, textAlign: "center" },

  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1d3546",
  },
  logoBox: {
    width: 48,
    height: 48,
    backgroundColor: "#172c3a",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  channelLogo: { width: 40, height: 40 },
  channelNoBadge: { color: "#8fa8b6", fontWeight: "700", fontSize: 13 },
  channelInfo: { flex: 1 },
  channelName: { fontSize: 15, fontWeight: "700", color: "#e8f1f5" },
  liveTag: {
    backgroundColor: "#ff4d6d",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  liveTagText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  channelCategory: { color: "#8fa8b6", fontSize: 11 },
  favButton: { padding: 6 },
  previewBtn: { padding: 6, marginRight: 4 },

  // EPG Metadata in Channel Row
  epgContainer: { marginTop: 4 },
  epgNowRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  epgNowTitle: { color: "#c1d3dc", fontSize: 13, fontWeight: "600", flex: 1 },
  epgRemaining: { color: "#ff8fa3", fontSize: 11, fontWeight: "600", marginLeft: 6 },
  epgProgressContainer: {
    height: 3,
    backgroundColor: "#203a4c",
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  epgProgressBar: { height: "100%", backgroundColor: "#ff6b8b" },
  epgNextTitle: { color: "#6e8b9d", fontSize: 11, marginTop: 3 },

  // 10-Foot TV EPG Grid Styles
  gridContainer: { flex: 1, paddingHorizontal: 12 },
  timeHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2a4557",
    paddingBottom: 6,
    marginBottom: 6,
  },
  gridChannelColumnHeader: { width: 140, justifyContent: "center" },
  gridHeaderChannelText: { color: "#8fa8b6", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  timeSlotBox: { width: 180, alignItems: "center" },
  timeSlotText: { color: "#ff8fa3", fontWeight: "700", fontSize: 12 },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    backgroundColor: "#142633",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1d3546",
    overflow: "hidden",
  },
  gridRowFocused: { borderColor: "#ff6b8b", backgroundColor: "#1c3547" },
  gridChannelBox: {
    width: 140,
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#2a4557",
  },
  gridChannelLogo: { width: 32, height: 32, justifyContent: "center", alignItems: "center", marginRight: 8 },
  channelLogoSmall: { width: 30, height: 30 },
  channelNoBadgeSmall: { color: "#8fa8b6", fontSize: 11, fontWeight: "700" },
  gridChannelName: { color: "#e8f1f5", fontSize: 13, fontWeight: "700", flex: 1 },

  programBlock: {
    padding: 10,
    borderRadius: 6,
    marginRight: 8,
    minHeight: 58,
    justifyContent: "center",
  },
  programBlockCurrent: { width: 220, backgroundColor: "#1b3345", borderWidth: 1, borderColor: "#2d5470" },
  programBlockNext: { width: 180, backgroundColor: "#162a39", borderWidth: 1, borderColor: "#203a4c" },
  programTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700", flex: 1 },
  programTime: { color: "#ff8fa3", fontSize: 10, fontWeight: "600", marginLeft: 4 },
  programDesc: { color: "#8fa8b6", fontSize: 11, marginTop: 4 },
  progressBarBg: { height: 2, backgroundColor: "#264a63", borderRadius: 1, marginTop: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#ff6b8b" },
  programTitleNext: { color: "#8fa8b6", fontSize: 12, fontWeight: "600", flex: 1 },
  programTimeNext: { color: "#617d8f", fontSize: 10, marginLeft: 4 },
  programDescNext: { color: "#617d8f", fontSize: 10, marginTop: 2 },

  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingText: { color: "#8fa8b6", marginTop: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#e8f1f5" },
  emptySub: { fontSize: 13, color: "#8fa8b6", textAlign: "center", marginTop: 6, lineHeight: 18 },
  addCta: {
    backgroundColor: "#ff6b8b",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 18,
  },
  addCtaText: { color: "#fff", fontWeight: "700" },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#10202b" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a4557",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#e8f1f5" },
  closeBtn: { color: "#ff6b8b", fontSize: 15, fontWeight: "700" },
  modalTabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2a4557",
    paddingHorizontal: 16,
    backgroundColor: "#142633",
  },
  modalTab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 8 },
  modalTabActive: { borderBottomWidth: 2, borderBottomColor: "#ff6b8b" },
  modalTabText: { color: "#8fa8b6", fontSize: 14, fontWeight: "600" },
  modalTabTextActive: { color: "#fff", fontWeight: "700" },

  formSectionHeader: { fontSize: 15, fontWeight: "700", color: "#e8f1f5", marginBottom: 10 },
  guideHelpText: { color: "#8fa8b6", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#172c3a",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  providerName: { color: "#e8f1f5", fontSize: 14, fontWeight: "600" },
  providerMeta: { color: "#8fa8b6", fontSize: 11, marginTop: 2 },
  removeBtn: { padding: 6 },
  providerSelectChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#172c3a",
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  providerSelectChipActive: { backgroundColor: "#203a4c", borderColor: "#ff6b8b" },
  providerSelectText: { color: "#8fa8b6", fontSize: 12 },
  providerSelectTextActive: { color: "#ff6b8b", fontWeight: "700" },

  inputLabel: { color: "#8fa8b6", fontSize: 12, fontWeight: "600", marginTop: 10, marginBottom: 6 },
  textInput: {
    backgroundColor: "#172c3a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a4557",
    color: "#e8f1f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 14 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#8fa8b6",
    marginRight: 10,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { backgroundColor: "#ff6b8b", borderColor: "#ff6b8b" },
  checkboxLabel: { flex: 1, color: "#8fa8b6", fontSize: 11, lineHeight: 16 },
  errorText: { color: "#ff4d6d", fontSize: 12, marginTop: 10 },
  submitButton: {
    backgroundColor: "#ff6b8b",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 18,
    marginBottom: 36,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
