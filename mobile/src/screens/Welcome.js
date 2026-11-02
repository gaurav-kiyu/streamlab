import React, { useState } from "react";
import { ScrollView, Text, Pressable, StyleSheet, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UI_LANGS, useUiLang } from "../i18n";

const isTV = Platform.isTV;

function LangButton({ item, autoFocus, onSelect }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={autoFocus}
      onPress={() => onSelect(item.code)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Select ${item.label}`}
      accessibilityHint="Sets the application language and regional content preferences"
      style={[styles.btn, focused && styles.focus]}
    >
      <Text style={styles.btnText}>{item.label}</Text>
    </Pressable>
  );
}

// First screen on a fresh install: one tap on your own language, no reading in English needed.
export default function Welcome() {
  const { setLang } = useUiLang();
  const { top, bottom } = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: "#10202b" }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: (isTV ? 48 : top) + 24, paddingBottom: (isTV ? 48 : bottom) + 24 },
        isTV && styles.tvContainer,
      ]}
    >
      <View style={styles.brandRow}>
        <Text style={styles.brandBadge}>🎬 StreamLab</Text>
      </View>
      <Text style={styles.title}>Choose Your Language</Text>
      <Text style={styles.sub}>अपनी भाषा चुनें · உங்கள் மொழியைத் தேர்ந்தெடுக்கவும் · మీ భాషను ఎంచుకోండి</Text>

      <View style={styles.grid}>
        {UI_LANGS.map((l, i) => (
          <LangButton key={l.code} item={l} autoFocus={i === 0} onSelect={setLang} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1 },
  tvContainer: { paddingHorizontal: 64, alignItems: "center" },
  brandRow: { marginBottom: 16 },
  brandBadge: {
    color: "#ff6b8b",
    fontSize: isTV ? 26 : 20,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: { color: "#e8f1f5", fontSize: isTV ? 38 : 28, fontWeight: "800", marginBottom: 8 },
  sub: { color: "#8fa8b6", fontSize: isTV ? 18 : 15, marginBottom: 28, lineHeight: 22 },
  grid: { width: "100%", maxWidth: 600 },
  btn: {
    minHeight: 52,
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: "#2a4557",
    backgroundColor: "#172c3a",
    marginBottom: 12,
  },
  focus: { borderColor: "#ff6b8b", transform: [{ scale: 1.03 }] },
  btnText: { color: "#e8f1f5", fontSize: isTV ? 24 : 18, fontWeight: "600" },
});
