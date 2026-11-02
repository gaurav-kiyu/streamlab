import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  BackHandler,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import Video from "react-native-video";
import { getSettings } from "../settings";
import { useT } from "../i18n";
import { loadPosition, savePosition, clearPosition, upsertRecent, removeRecent } from "../storage";
import { syncCloudProgress } from "../api";

const isTV = Platform.isTV;

function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const remS = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(remM)}:${pad(remS)}` : `${pad(remM)}:${pad(remS)}`;
}

const badge = (h) =>
  `${h >= 2160 ? "4K " : h >= 1440 ? "QHD " : h >= 1080 ? "FHD " : h >= 720 ? "HD " : ""}${h}p`;

export default function Player({ url, item, onClose }) {
  const t = useT();
  const ref = useRef(null);
  const resumeAt = useRef(0);
  const lastSaved = useRef(0);
  const hideTimer = useRef(null);
  const initialSeekDone = useRef(false);

  // Playback state
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // Track selection state
  const [heights, setHeights] = useState([]);
  const [qIdx, setQIdx] = useState(-1); // -1 = auto
  const [textTracks, setTextTracks] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [textIndex, setTextIndex] = useState(-1);
  const [audioIndex, setAudioIndex] = useState(0);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    if (!paused) {
      hideTimer.current = setTimeout(() => setShowControls(false), 4500);
    }
  }, [paused]);

  const toggleControls = () => {
    if (showControls) setShowControls(false);
    else resetHideTimer();
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [resetHideTimer]);

  // Back button handling
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // Load saved position (VOD only; live streams start at live edge)
  useEffect(() => {
    if (item?.isLive) {
      resumeAt.current = 0;
      setReady(true);
      return;
    }
    loadPosition(url).then((p) => {
      resumeAt.current = p;
      setReady(true);
    });
  }, [url, item?.isLive]);

  const onLoad = (d) => {
    setDuration(d.duration || 0);
    setTextTracks(d.textTracks || []);
    setAudioTracks(d.audioTracks || []);
    const availableHeights = [...new Set((d.videoTracks || []).map((v) => v.height).filter(Boolean))].sort(
      (a, b) => b - a
    );
    setHeights(availableHeights);
    setBuffering(false);
  };

  const onReadyForDisplay = () => {
    setBuffering(false);
    if (!item?.isLive && !initialSeekDone.current && resumeAt.current > 5) {
      initialSeekDone.current = true;
      ref.current?.seek(resumeAt.current);
    }
  };

  const finish = () => {
    clearPosition(url);
    removeRecent(url);
  };

  const onProgress = ({ currentTime: curr, seekableDuration }) => {
    setCurrentTime(curr);
    if (item?.isLive) {
      // Live stream: do not write to VOD resume position or sync VOD cloud progress
      return;
    }
    if (curr - lastSaved.current < 5) return;
    lastSaved.current = curr;

    const dur = seekableDuration || duration;
    if (dur && dur - curr < 15) {
      finish();
    } else {
      savePosition(url, curr);
      upsertRecent(item, url, curr, dur);
      syncCloudProgress(item, url, curr, dur);
    }
  };

  const seekRelative = (sec) => {
    if (item?.isLive) return;
    resetHideTimer();
    const target = Math.max(0, Math.min(duration, currentTime + sec));
    ref.current?.seek(target);
    setCurrentTime(target);
  };

  const retryPlayback = () => {
    setFailed(false);
    setErrorMsg("");
    setBuffering(true);
    setRetryKey((k) => k + 1);
  };

  const nextSub = () => {
    resetHideTimer();
    setTextIndex((i) => (i + 1 >= textTracks.length ? -1 : i + 1));
  };

  const nextAudio = () => {
    resetHideTimer();
    setAudioIndex((i) => (i + 1) % audioTracks.length);
  };

  const nextQuality = () => {
    resetHideTimer();
    setQIdx((i) => (i + 1 >= heights.length ? -1 : i + 1));
  };

  const name = (t, i) => t?.title || t?.language || `Track ${i + 1}`;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  if (!ready) return <View style={styles.wrap} />;

  return (
    <TouchableWithoutFeedback onPress={toggleControls}>
      <View style={styles.wrap}>
        <Video
          key={retryKey}
          ref={ref}
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          paused={paused}
          progressUpdateInterval={500}
          maxBitRate={getSettings().dataSaver ? 1200000 : undefined}
          onLoad={onLoad}
          onReadyForDisplay={onReadyForDisplay}
          onProgress={onProgress}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          onEnd={finish}
          selectedTextTrack={textIndex === -1 ? { type: "disabled" } : { type: "index", value: textIndex }}
          selectedAudioTrack={{ type: "index", value: audioIndex }}
          selectedVideoTrack={qIdx === -1 ? { type: "auto" } : { type: "resolution", value: heights[qIdx] }}
          onError={(e) => {
            setFailed(true);
            setBuffering(false);
            setErrorMsg(e?.error?.errorString || t("playbackFailed"));
          }}
        />

        {/* Buffering Spinner */}
        {buffering && !failed && (
          <View style={styles.centerOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#ff6b8b" />
          </View>
        )}

        {/* Error Screen */}
        {failed && (
          <View style={styles.centerOverlay}>
            <Text style={styles.errTitle}>Playback Failed</Text>
            <Text style={styles.errDesc}>{errorMsg || t("playbackFailed")}</Text>
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={retryPlayback}>
                <Text style={styles.btnText}>Retry</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={onClose}>
                <Text style={styles.btnText}>{t("back")}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* On-Screen Controls Overlay */}
        {showControls && !failed && (
          <View style={styles.controlsOverlay}>
            {/* Top Bar: Title & Back */}
            <View style={styles.topBar}>
              <Pressable
                hasTVPreferredFocus={isTV}
                style={styles.backBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Text style={styles.backBtnText}>✕ Close</Text>
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>
                {item?.title || "StreamLab Player"}
              </Text>
              <View style={styles.trackPills}>
                {heights.length > 1 && (
                  <Pressable style={styles.pill} onPress={nextQuality}>
                    <Text style={styles.pillText}>
                      {qIdx === -1 ? t("auto") : badge(heights[qIdx])}
                    </Text>
                  </Pressable>
                )}
                {textTracks.length > 0 && (
                  <Pressable style={styles.pill} onPress={nextSub}>
                    <Text style={styles.pillText}>
                      {textIndex === -1 ? `${t("subs")}: ${t("off")}` : `${t("subs")}: ${name(textTracks[textIndex], textIndex)}`}
                    </Text>
                  </Pressable>
                )}
                {audioTracks.length > 1 && (
                  <Pressable style={styles.pill} onPress={nextAudio}>
                    <Text style={styles.pillText}>
                      {name(audioTracks[audioIndex], audioIndex)}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              {!item?.isLive && (
                <Pressable
                  style={styles.circleBtn}
                  onPress={() => seekRelative(-10)}
                  accessibilityLabel="Rewind 10 seconds"
                >
                  <Text style={styles.circleBtnText}>⏪ 10s</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.circleBtn, styles.playBtn]}
                onPress={() => {
                  setPaused(!paused);
                  resetHideTimer();
                }}
                accessibilityLabel={paused ? "Play" : "Pause"}
              >
                <Text style={styles.playBtnText}>{paused ? "▶" : "⏸"}</Text>
              </Pressable>

              {!item?.isLive && (
                <Pressable
                  style={styles.circleBtn}
                  onPress={() => seekRelative(10)}
                  accessibilityLabel="Forward 10 seconds"
                >
                  <Text style={styles.circleBtnText}>10s ⏩</Text>
                </Pressable>
              )}
            </View>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
              {item?.isLive ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ff4d6d", marginRight: 8 }} />
                    <Text style={{ color: "#ff4d6d", fontWeight: "800", fontSize: 14 }}>LIVE STREAM</Text>
                  </View>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.scrubber}>
                    <View style={[styles.scrubberFill, { width: `${pct}%` }]} />
                  </View>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 24,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "space-between",
    padding: isTV ? 32 : 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    backgroundColor: "rgba(23,44,58,0.85)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#2a4557",
  },
  backBtnText: { color: "#e8f1f5", fontWeight: "600", fontSize: 16 },
  titleText: {
    flex: 1,
    color: "#e8f1f5",
    fontSize: isTV ? 22 : 18,
    fontWeight: "700",
    marginHorizontal: 16,
    textAlign: "center",
  },
  trackPills: { flexDirection: "row", gap: 8 },
  pill: {
    backgroundColor: "rgba(23,44,58,0.85)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#2a4557",
  },
  pillText: { color: "#e8f1f5", fontSize: 13, fontWeight: "600" },
  centerControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: isTV ? 48 : 28,
  },
  circleBtn: {
    width: isTV ? 72 : 56,
    height: isTV ? 72 : 56,
    borderRadius: isTV ? 36 : 28,
    backgroundColor: "rgba(23,44,58,0.85)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2a4557",
  },
  circleBtnText: { color: "#e8f1f5", fontSize: isTV ? 16 : 14, fontWeight: "700" },
  playBtn: {
    width: isTV ? 96 : 74,
    height: isTV ? 96 : 74,
    borderRadius: isTV ? 48 : 37,
    backgroundColor: "#ff6b8b",
    borderColor: "#ff6b8b",
  },
  playBtnText: { color: "#10202b", fontSize: isTV ? 40 : 32, fontWeight: "800" },
  bottomBar: { paddingBottom: 10 },
  scrubber: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  scrubberFill: { height: 6, backgroundColor: "#ff6b8b", borderRadius: 3 },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { color: "#e8f1f5", fontSize: 13, fontWeight: "600" },
  errTitle: { color: "#ff6b8b", fontSize: 24, fontWeight: "700", marginBottom: 12 },
  errDesc: { color: "#8fa8b6", fontSize: 16, textAlign: "center", marginBottom: 24, maxWidth: 500 },
  row: { flexDirection: "row", gap: 16 },
  btn: {
    backgroundColor: "rgba(23,44,58,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#2a4557",
  },
  btnText: { color: "#e8f1f5", fontSize: 16, fontWeight: "600" },
});
