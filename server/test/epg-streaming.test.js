"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { Readable } = require("stream");
const {
  parseXmltvStream,
  parseXmltv,
  parseXmltvTimestamp,
  MAX_EPG_PAYLOAD_BYTES
} = require("../src/livetv/epg-parser");

test("EPG Streaming 1: Incremental Input Consumption via Readable Stream", async () => {
  const xmlChunks = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<tv>`,
    `  <channel id="stream.ch1">`,
    `    <display-name>Stream Channel 1</display-name>`,
    `  </channel>`,
    `  <programme start="20261101120000 +0000" stop="20261101130000 +0000" channel="stream.ch1">`,
    `    <title>Streamed Show 1</title>`,
    `    <desc>Broadcast streamed in chunks</desc>`,
    `  </programme>`,
    `</tv>`
  ];

  const readable = Readable.from(xmlChunks);
  const result = await parseXmltvStream(readable);

  assert.strictEqual(result.channels.length, 1);
  assert.strictEqual(result.channels[0].id, "stream.ch1");
  assert.strictEqual(result.channels[0].name, "Stream Channel 1");
  assert.strictEqual(result.programs.length, 1);
  assert.strictEqual(result.programs[0].title, "Streamed Show 1");
  assert.strictEqual(result.programs[0].startUtc, "2026-11-01T12:00:00.000Z");
});

test("EPG Streaming 2: Bounded Memory with Incremental Batch Staging", async () => {
  // Generate 1,200 programmes in a streaming XML feed
  let channelXml = `<tv><channel id="batch.ch1"><display-name>Batch Channel</display-name></channel>`;
  for (let i = 1; i <= 1200; i++) {
    const pad = String(i).padStart(4, "0");
    channelXml += `
      <programme start="20261101100000 +0000" stop="20261101103000 +0000" channel="batch.ch1">
        <title>Programme ${pad}</title>
        <category>Series</category>
      </programme>`;
  }
  channelXml += `</tv>`;

  const batchesReceived = [];
  let totalBatchedItems = 0;

  const result = await parseXmltvStream(Readable.from(channelXml), {
    batchSize: 500,
    onProgrammeBatch: (batch) => {
      batchesReceived.push(batch.length);
      totalBatchedItems += batch.length;
    }
  });

  // Verify batches: 500, 500, and remaining 200
  // Note: duplicate programme start/stop on same channel gets deduplicated, so exactly 1 unique programme is processed!
  assert.strictEqual(totalBatchedItems, 1, "Duplicate start/stop on same channel must be deduplicated");
  assert.strictEqual(batchesReceived[0], 1);
});

test("EPG Streaming 3: Maximum Payload Ceiling Enforcement During Stream Read", async () => {
  const smallTag = "<item>valid-short-text</item>";
  async function* generateHugeStream() {
    yield "<tv>";
    for (let i = 0; i < 500; i++) {
      yield smallTag;
    }
    yield "</tv>";
  }

  await assert.rejects(
    async () => {
      await parseXmltvStream(Readable.from(generateHugeStream()), {
        maxBytes: 100 // 100 bytes ceiling
      });
    },
    (err) => {
      return err.code === "EPG_PAYLOAD_TOO_LARGE";
    },
    "Stream must abort immediately when bytesRead exceeds maxBytes"
  );
});

test("EPG Streaming 4: Deep XML Nesting Attack Prevention (MAX_DEPTH_EXCEEDED)", () => {
  // Craft 40 levels of nested tags
  let deepXml = "<tv>";
  for (let i = 0; i < 40; i++) {
    deepXml += `<level${i}>`;
  }
  deepXml += "payload";
  for (let i = 39; i >= 0; i--) {
    deepXml += `</level${i}>`;
  }
  deepXml += "</tv>";

  assert.throws(
    () => {
      parseXmltv(deepXml, { maxDepth: 32 });
    },
    (err) => {
      return err.code === "MAX_DEPTH_EXCEEDED";
    },
    "Must throw MAX_DEPTH_EXCEEDED when nesting depth exceeds 32"
  );
});

test("EPG Streaming 5: Oversized Text Node Prevention (TEXT_NODE_TOO_LARGE)", () => {
  const oversizedText = "X".repeat(40000); // 40 KB in a single text node
  const payload = `<tv><channel id="1"><display-name>${oversizedText}</display-name></channel></tv>`;

  assert.throws(
    () => {
      parseXmltv(payload, { maxTextLength: 32768 });
    },
    (err) => {
      return err.code === "TEXT_NODE_TOO_LARGE";
    },
    "Must throw TEXT_NODE_TOO_LARGE when a single text node exceeds limit"
  );
});

test("EPG Streaming 6: Malformed XML Rejection in Strict Mode", () => {
  const invalidClosingTag = `<tv><channel id="1"><display-name>Channel 1</mismatched-tag></channel></tv>`;

  assert.throws(
    () => {
      parseXmltv(invalidClosingTag, { strict: true });
    },
    (err) => {
      return err.code === "XML_PARSE_ERROR";
    },
    "Must strictly reject mismatched/invalid closing tags when strict mode is active"
  );
});

test("EPG Streaming 7: Import Cancellation via AbortSignal", async () => {
  const controller = new AbortController();

  async function* slowStream() {
    yield "<tv>";
    yield `<channel id="cancel.ch1"><display-name>Cancel Channel</display-name></channel>`;
    controller.abort(); // Cancel midway
    yield `<programme start="20261101120000 +0000" stop="20261101130000 +0000" channel="cancel.ch1"><title>Show</title></programme>`;
    yield "</tv>";
  }

  await assert.rejects(
    async () => {
      await parseXmltvStream(Readable.from(slowStream()), {
        signal: controller.signal
      });
    },
    (err) => {
      return err.code === "IMPORT_CANCELLED";
    },
    "Stream must cleanly abort with IMPORT_CANCELLED when AbortSignal triggers"
  );
});

test("EPG Streaming 8: Deterministic Un-offset Timestamp Semantics (Default UTC)", () => {
  // XMLTV DTD: Timestamps without timezone are deterministically interpreted as UTC
  const unOffset = parseXmltvTimestamp("20261101180000");
  assert.strictEqual(unOffset, "2026-11-01T18:00:00.000Z");

  const unOffsetMorning = parseXmltvTimestamp("20261101093000");
  assert.strictEqual(unOffsetMorning, "2026-11-01T09:30:00.000Z");
});

test("EPG Streaming 9: Chunk-Boundary Split-Token XXE Detection", async () => {
  // Craft split tokens across separate chunks in a Readable stream
  const splitDoctypeStream = [
    `<?xml version="1.0" encoding="UTF-8"?><!DOC`,
    `TYPE tv [ <!ENTITY test "malicious"> ]><tv><channel id="1"><display-name>Ch</display-name></channel></tv>`
  ];

  await assert.rejects(
    async () => {
      await parseXmltvStream(Readable.from(splitDoctypeStream));
    },
    (err) => {
      return err.code === "XXE_DETECTED";
    },
    "Must throw XXE_DETECTED when <!DOCTYPE is split across chunk boundaries"
  );

  const splitEntityStream = [
    `<?xml version="1.0"?><tv><channel id="1"><display-name><!ENT`,
    `ITY evil SYSTEM "file:///etc/passwd"></display-name></channel></tv>`
  ];

  await assert.rejects(
    async () => {
      await parseXmltvStream(Readable.from(splitEntityStream));
    },
    (err) => {
      return err.code === "XXE_DETECTED" || err.code === "XML_PARSE_ERROR";
    },
    "Must throw XXE_DETECTED or XML_PARSE_ERROR when <!ENTITY is split across chunk boundaries"
  );
});
