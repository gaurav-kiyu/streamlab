"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { parseXmltv, parseXmltvTimestamp, MAX_EPG_PAYLOAD_BYTES } = require("../src/livetv/epg-parser");

test("EPG 1: XMLTV Timestamp Parsing & UTC Normalization", () => {
  // Test +0530 offset (IST -> UTC is -5h30m)
  const istTime = parseXmltvTimestamp("20261101180000 +0530");
  assert.strictEqual(istTime, "2026-11-01T12:30:00.000Z");

  // Test -0400 offset (EDT -> UTC is +4h)
  const edtTime = parseXmltvTimestamp("20261101100000 -0400");
  assert.strictEqual(edtTime, "2026-11-01T14:00:00.000Z");

  // Test UTC offset (+0000, UTC, Z)
  assert.strictEqual(parseXmltvTimestamp("20261101120000 +0000"), "2026-11-01T12:00:00.000Z");
  assert.strictEqual(parseXmltvTimestamp("20261101120000 UTC"), "2026-11-01T12:00:00.000Z");
  assert.strictEqual(parseXmltvTimestamp("20261101120000 Z"), "2026-11-01T12:00:00.000Z");

  // Test un-offset timestamp (treated as UTC)
  assert.strictEqual(parseXmltvTimestamp("20261101120000"), "2026-11-01T12:00:00.000Z");

  // Test invalid timestamps
  assert.strictEqual(parseXmltvTimestamp(""), null);
  assert.strictEqual(parseXmltvTimestamp(null), null);
  assert.strictEqual(parseXmltvTimestamp("invalid-timestamp"), null);
  assert.strictEqual(parseXmltvTimestamp("20261399999999"), null); // Invalid month 13
});

test("EPG 2: XXE and Billion Laughs Attack Prevention", () => {
  const xxePayload = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE tv [
    <!ENTITY xxe SYSTEM "file:///etc/passwd">
  ]>
  <tv>
    <channel id="xxe.channel">
      <display-name>&xxe;</display-name>
    </channel>
  </tv>`;

  assert.throws(
    () => {
      parseXmltv(xxePayload);
    },
    (err) => {
      return err.code === "XXE_DETECTED" && err.message.includes("prohibited in XMLTV feeds");
    },
    "Parser must strictly reject <!DOCTYPE and XXE payloads"
  );

  const billionLaughsPayload = `<?xml version="1.0"?>
  <!DOCTYPE lolz [
    <!ENTITY lol "lol">
    <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  ]>
  <tv><channel id="1"><display-name>&lol2;</display-name></channel></tv>`;

  assert.throws(
    () => {
      parseXmltv(billionLaughsPayload);
    },
    (err) => {
      return err.code === "XXE_DETECTED";
    },
    "Parser must strictly reject entity expansion attacks"
  );
});

test("EPG 3: Payload Size Ceiling Enforcement", () => {
  assert.strictEqual(MAX_EPG_PAYLOAD_BYTES, 25 * 1024 * 1024, "Max ceiling must be 25 MB");

  // Test oversized string handling
  const hugeXml = "<tv>" + " ".repeat(100) + "</tv>";
  // With maxBytes = 50
  assert.throws(
    () => {
      parseXmltv(hugeXml, { maxBytes: 50 });
    },
    (err) => {
      return err.code === "EPG_PAYLOAD_TOO_LARGE";
    },
    "Must throw EPG_PAYLOAD_TOO_LARGE when payload exceeds maxBytes limit"
  );
});

test("EPG 4: Standard XMLTV Guide Parsing & Channel/Program Extraction", () => {
  const xmltvSample = `<?xml version="1.0" encoding="UTF-8"?>
  <tv generator-info-name="StreamLab EPG Test">
    <channel id="dd.national">
      <display-name>DD National HD</display-name>
      <icon src="https://example.com/dd-national.png" />
      <lcn>101</lcn>
    </channel>
    <channel id="dd.sports">
      <display-name>DD Sports</display-name>
      <icon src="https://example.com/dd-sports.png" />
    </channel>

    <programme start="20261101180000 +0530" stop="20261101190000 +0530" channel="dd.national">
      <title lang="en">Evening Prime News</title>
      <desc lang="en">Comprehensive daily national and international news coverage.</desc>
      <category>News</category>
      <icon src="https://example.com/news-poster.jpg" />
    </programme>

    <programme start="20261101190000 +0530" stop="20261101200000 +0530" channel="dd.national">
      <title lang="en">Krishi Darshan</title>
      <desc lang="en">Agricultural science and innovation documentary.</desc>
      <category>Documentary</category>
    </programme>

    <programme start="20261101180000 +0530" stop="20261101210000 +0530" channel="dd.sports">
      <title lang="en">Live Cricket Match</title>
      <desc lang="en">India vs Australia ODI live coverage.</desc>
      <category>Sports</category>
    </programme>

    <!-- Duplicate programme to verify deduplication -->
    <programme start="20261101180000 +0530" stop="20261101190000 +0530" channel="dd.national">
      <title lang="en">Evening Prime News (Duplicate Entry)</title>
      <desc lang="en">Duplicate entry that must be deduplicated.</desc>
    </programme>

    <!-- Invalid programme without channel -->
    <programme start="20261101180000 +0530" stop="20261101190000 +0530">
      <title>Orphan Programme</title>
    </programme>
  </tv>`;

  const result = parseXmltv(xmltvSample);

  // Verify channels
  assert.strictEqual(result.channels.length, 2);
  const ch1 = result.channels.find((c) => c.id === "dd.national");
  assert.ok(ch1);
  assert.strictEqual(ch1.name, "DD National HD");
  assert.strictEqual(ch1.logoUrl, "https://example.com/dd-national.png");
  assert.strictEqual(ch1.channelNumber, 101);

  const ch2 = result.channels.find((c) => c.id === "dd.sports");
  assert.ok(ch2);
  assert.strictEqual(ch2.name, "DD Sports");

  // Verify programmes
  assert.strictEqual(result.programmes.length, 3, "Must extract 3 valid programmes and de-duplicate the 4th");

  const prog1 = result.programmes.find((p) => p.channelId === "dd.national" && p.category === "News");
  assert.ok(prog1);
  assert.strictEqual(prog1.title, "Evening Prime News");
  assert.strictEqual(prog1.startUtc, "2026-11-01T12:30:00.000Z");
  assert.strictEqual(prog1.stopUtc, "2026-11-01T13:30:00.000Z");
  assert.strictEqual(prog1.posterUrl, "https://example.com/news-poster.jpg");

  const sportsProg = result.programmes.find((p) => p.channelId === "dd.sports");
  assert.ok(sportsProg);
  assert.strictEqual(sportsProg.title, "Live Cricket Match");
  assert.strictEqual(sportsProg.category, "Sports");
});

test("EPG 5: Robust Handling of Malformed and Empty XML", () => {
  const emptyRes = parseXmltv("");
  assert.strictEqual(emptyRes.channels.length, 0);
  assert.strictEqual(emptyRes.programs.length, 0);

  const tvEmptyRes = parseXmltv("<tv></tv>");
  assert.strictEqual(tvEmptyRes.channels.length, 0);
  assert.strictEqual(tvEmptyRes.programs.length, 0);

  const malformedXml = `<tv>
    <channel id="broken">
      <display-name>Broken Channel
    </channel>
    <programme start="invalid-time" stop="2026" channel="broken">
      <title>No Valid Time</title>
    </programme>
  </tv>`;

  const result = parseXmltv(malformedXml);
  assert.ok(Array.isArray(result.channels));
  assert.strictEqual(result.programmes.length, 0, "Programmes with invalid timestamps must be safely ignored");
});
