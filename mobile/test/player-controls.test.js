import test from "node:test";
import assert from "node:assert";

// Core logic helpers matching Player.js implementation
function computeSeekTarget(currentTime, duration, delta, isLive) {
  if (isLive) return currentTime;
  const maxDur = duration > 0 ? duration : 86400;
  return Math.max(0, Math.min(maxDur, currentTime + delta));
}

function computeScrubberSeekTarget(locationX, scrubberWidth, duration, isLive) {
  if (isLive || duration <= 0) return null;
  const width = scrubberWidth > 0 ? scrubberWidth : 1;
  return Math.max(0, Math.min(duration, (locationX / width) * duration));
}

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

test("Player Controls 1: Explicit ±10s and ±20s Seeking with Duration Bounds", () => {
  const duration = 7200; // 2 hour movie

  // Normal ±10s jumps
  assert.strictEqual(computeSeekTarget(100, duration, -10, false), 90);
  assert.strictEqual(computeSeekTarget(100, duration, 10, false), 110);

  // Mandatory Phase 21.2 secondary ±20s jumps
  assert.strictEqual(computeSeekTarget(100, duration, -20, false), 80);
  assert.strictEqual(computeSeekTarget(100, duration, 20, false), 120);

  // Lower bound clamping at 0s
  assert.strictEqual(computeSeekTarget(15, duration, -20, false), 0);
  assert.strictEqual(computeSeekTarget(5, duration, -10, false), 0);
  assert.strictEqual(computeSeekTarget(0, duration, -20, false), 0);

  // Upper bound clamping at duration
  assert.strictEqual(computeSeekTarget(7190, duration, 20, false), 7200);
  assert.strictEqual(computeSeekTarget(7195, duration, 10, false), 7200);
  assert.strictEqual(computeSeekTarget(7200, duration, 20, false), 7200);
});

test("Player Controls 2: Live Stream Seeking Immunity Guard", () => {
  const currentTime = 540;
  const duration = 0; // Live streams have indeterminate/zero duration

  // All relative seeks must be no-ops on live streams
  assert.strictEqual(computeSeekTarget(currentTime, duration, -20, true), currentTime);
  assert.strictEqual(computeSeekTarget(currentTime, duration, -10, true), currentTime);
  assert.strictEqual(computeSeekTarget(currentTime, duration, 10, true), currentTime);
  assert.strictEqual(computeSeekTarget(currentTime, duration, 20, true), currentTime);
});

test("Player Controls 3: Interactive Timeline Scrubber Seek Calculation", () => {
  const duration = 3600; // 1 hour
  const scrubberWidth = 320; // 320 dp container width

  // Tap at start (0 dp) -> 0 seconds
  assert.strictEqual(computeScrubberSeekTarget(0, scrubberWidth, duration, false), 0);

  // Tap at exact middle (160 dp) -> 1800 seconds (30m)
  assert.strictEqual(computeScrubberSeekTarget(160, scrubberWidth, duration, false), 1800);

  // Tap at 3/4 point (240 dp) -> 2700 seconds (45m)
  assert.strictEqual(computeScrubberSeekTarget(240, scrubberWidth, duration, false), 2700);

  // Tap at end (320 dp) -> 3600 seconds (60m)
  assert.strictEqual(computeScrubberSeekTarget(320, scrubberWidth, duration, false), 3600);

  // Negative location clamped to 0
  assert.strictEqual(computeScrubberSeekTarget(-25, scrubberWidth, duration, false), 0);

  // Overshot location clamped to duration
  assert.strictEqual(computeScrubberSeekTarget(400, scrubberWidth, duration, false), 3600);

  // Scrubber disabled on live streams
  assert.strictEqual(computeScrubberSeekTarget(160, scrubberWidth, duration, true), null);
});

test("Player Controls 4: Timestamp Formatting (HH:MM:SS vs MM:SS)", () => {
  assert.strictEqual(formatTime(0), "00:00");
  assert.strictEqual(formatTime(45), "00:45");
  assert.strictEqual(formatTime(125), "02:05");
  assert.strictEqual(formatTime(3599), "59:59");
  assert.strictEqual(formatTime(3600), "1:00:00");
  assert.strictEqual(formatTime(7265), "2:01:05");
  assert.strictEqual(formatTime(-10), "00:00");
  assert.strictEqual(formatTime(null), "00:00");
  assert.strictEqual(formatTime(NaN), "00:00");
});
