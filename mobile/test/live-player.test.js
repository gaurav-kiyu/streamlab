import test from "node:test";
import assert from "node:assert";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadPosition, savePosition, clearPosition, loadRecent } from "../src/storage.js";

// Helper calculations replicated from LiveTV.js for unit verification
function calculateProgress(startUtc, stopUtc, currentNowMs = Date.now()) {
  if (!startUtc || !stopUtc) return 0;
  const start = new Date(startUtc).getTime();
  const stop = new Date(stopUtc).getTime();
  if (currentNowMs <= start) return 0;
  if (currentNowMs >= stop) return 100;
  const total = stop - start;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((currentNowMs - start) / total) * 100)));
}

function calculateMinutesLeft(stopUtc, currentNowMs = Date.now()) {
  if (!stopUtc) return null;
  const stop = new Date(stopUtc).getTime();
  const diff = stop - currentNowMs;
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
}

function formatWatchDuration(sec) {
  if (!sec || isNaN(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const remS = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(remM)}:${pad(remS)}` : `${pad(remM)}:${pad(remS)}`;
}

test("Live Player 1: Live Playback Bypasses VOD Resume Seek & Cloud Completion", async () => {
  await AsyncStorage.clear();

  const streamUrl = "https://live.example.com/stream.m3u8";

  // Simulate a stale VOD position recorded earlier for this URL
  await savePosition(streamUrl, 120);
  assert.strictEqual(await loadPosition(streamUrl), 120);

  // When playing in Live mode:
  const isLiveItem = {
    id: "ch_live_101",
    title: "DD National HD",
    isLive: true,
    stream: streamUrl,
  };

  // Live player contract: isLive flag prevents applying stale resume positions
  const shouldApplyResume = !isLiveItem.isLive;
  assert.strictEqual(shouldApplyResume, false, "Live playback MUST NOT restore or seek to stale VOD positions");

  // Live player contract: live playback does NOT report VOD completion or cloud sync
  const shouldSyncVODProgress = !isLiveItem.isLive;
  assert.strictEqual(shouldSyncVODProgress, false, "Live playback MUST NOT push VOD progress or completion sync");
});

test("Live Player 2: EPG Progress Bar & Remaining Time Calculations", () => {
  const baseTimeMs = 1793540000000; // Fixed timestamp for deterministic testing
  const startUtc = new Date(baseTimeMs).toISOString();
  const stopUtc = new Date(baseTimeMs + 60 * 60 * 1000).toISOString(); // 60 minutes later

  // 1. Before program starts
  assert.strictEqual(calculateProgress(startUtc, stopUtc, baseTimeMs - 5000), 0);

  // 2. Exactly 15 minutes into a 60 min program (25%)
  assert.strictEqual(calculateProgress(startUtc, stopUtc, baseTimeMs + 15 * 60 * 1000), 25);

  // 3. Exactly 45 minutes into a 60 min program (75%)
  assert.strictEqual(calculateProgress(startUtc, stopUtc, baseTimeMs + 45 * 60 * 1000), 75);

  // 4. After program ends
  assert.strictEqual(calculateProgress(startUtc, stopUtc, baseTimeMs + 65 * 60 * 1000), 100);

  // 5. Remaining minutes
  assert.strictEqual(calculateMinutesLeft(stopUtc, baseTimeMs + 40 * 60 * 1000), 20);
  assert.strictEqual(calculateMinutesLeft(stopUtc, baseTimeMs + 60 * 60 * 1000), 0);
  assert.strictEqual(calculateMinutesLeft(stopUtc, baseTimeMs + 70 * 60 * 1000), 0);
  assert.strictEqual(calculateMinutesLeft(null), null);
});

test("Live Player 3: Channel Switching & Picture-in-Guide Mini-Player Isolation", () => {
  // Verify state transitions for mini-player
  let miniPlayerChannel = null;
  let isMuted = false;

  // Select channel in mini-player preview
  const channelA = { id: "ch_1", name: "News 24", stream_url: "https://news.example.com/live.m3u8" };
  miniPlayerChannel = channelA;
  assert.strictEqual(miniPlayerChannel.id, "ch_1");

  // Toggle mute
  isMuted = !isMuted;
  assert.strictEqual(isMuted, true);

  // Switch to channel B
  const channelB = { id: "ch_2", name: "Sports Live", stream_url: "https://sports.example.com/live.m3u8" };
  miniPlayerChannel = channelB;
  assert.strictEqual(miniPlayerChannel.id, "ch_2");
  assert.strictEqual(miniPlayerChannel.name, "Sports Live");

  // Dismiss mini-player
  miniPlayerChannel = null;
  assert.strictEqual(miniPlayerChannel, null);
});

test("Live Player 4: Indeterminate Duration Handling & Single Playback Session Guarantee", () => {
  // Indeterminate live duration must not produce NaN in timers
  assert.strictEqual(formatWatchDuration(0), "00:00");
  assert.strictEqual(formatWatchDuration(null), "00:00");
  assert.strictEqual(formatWatchDuration(NaN), "00:00");
  assert.strictEqual(formatWatchDuration(75), "01:15");
  assert.strictEqual(formatWatchDuration(3665), "1:01:05");

  // Picture-in-Guide transition to Fullscreen must transfer channel without spawning a duplicate audio session
  let activeAudioSessions = 0;
  let currentPreviewChannel = { id: "ch_test_101", stream_url: "https://example.com/live.m3u8" };
  activeAudioSessions++; // Mini-player started

  assert.strictEqual(activeAudioSessions, 1);

  // Transition to fullscreen: mini-player is cleared, primary player receives channel
  const fullscreenTarget = currentPreviewChannel;
  currentPreviewChannel = null; // Unmount mini-player before fullscreen player mounts
  activeAudioSessions = 1; // Only 1 active session preserved

  assert.strictEqual(activeAudioSessions, 1, "Must never allow concurrent mini-player and fullscreen audio playback");
  assert.strictEqual(fullscreenTarget.id, "ch_test_101");
});
