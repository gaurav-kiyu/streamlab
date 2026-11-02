import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  Pressable,
  Switch,
  View,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { getSettings, saveSettings } from "../settings";
import { connect, QUALITIES } from "../jellyfin";
import { useT, useUiLang, UI_LANGS } from "../i18n";
import { login, logout, fetchProfiles, createProfile, deleteProfile } from "../api";

const isTV = Platform.isTV;

function Opt({ label, on, onPress }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[styles.opt, on && styles.optOn, focused && styles.focus]}
    >
      <Text style={styles.optText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, ...rest }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#8fa8b6"
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

export default function Settings() {
  const t = useT();
  const { lang, setLang } = useUiLang();
  const [s, setS] = useState(getSettings());
  const [adv, setAdv] = useState(false);
  const [authView, setAuthView] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileIsKids, setNewProfileIsKids] = useState(false);
  const [newProfilePin, setNewProfilePin] = useState("");
  const [status, setStatus] = useState("");

  const set = (k) => (v) => setS((p) => ({ ...p, [k]: v }));
  const choose = (k, v) => {
    set(k)(v);
    saveSettings({ [k]: v });
  };

  const loadUserProfiles = async () => {
    if (s.currentUser) {
      const list = await fetchProfiles();
      setProfiles(list);
    } else {
      setProfiles([]);
    }
  };

  useEffect(() => {
    loadUserProfiles();
  }, [s.currentUser]);

  const handleLogin = async () => {
    if (!usernameInput || !passwordInput) {
      Alert.alert("Input Required", "Enter both username and password.");
      return;
    }
    try {
      const user = await login(usernameInput, passwordInput);
      setS((prev) => ({ ...prev, currentUser: user }));
      setAuthView(false);
      setUsernameInput("");
      setPasswordInput("");
      setStatus(`Signed in as ${user.username}`);
      loadUserProfiles();
    } catch (e) {
      Alert.alert("Login Failed", e.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    setS((prev) => ({ ...prev, currentUser: null, activeProfile: null }));
    setProfiles([]);
    setStatus("Signed out.");
  };

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return;
    try {
      await createProfile(newProfileName.trim(), newProfileIsKids, newProfilePin || null);
      setNewProfileName("");
      setNewProfileIsKids(false);
      setNewProfilePin("");
      loadUserProfiles();
      Alert.alert("Profile Created", "New profile is ready.");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const selectProfile = (p) => {
    saveSettings({ activeProfile: p });
    setS((prev) => ({ ...prev, activeProfile: p }));
    Alert.alert("Profile Selected", `Active profile: ${p.name}${p.is_kids ? " (Kids Mode)" : ""}`);
  };

  const saveAdvanced = async () => {
    await saveSettings(s);
    if (!s.jfUrl) {
      setStatus("Settings saved.");
      return;
    }
    setStatus("Testing Jellyfin connectivity...");
    try {
      await connect();
      setStatus("Successfully connected to your Jellyfin server.");
    } catch (e) {
      setStatus(`Could not connect: ${e.message}. Ensure the URL includes http:// and port.`);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.wrap, isTV && styles.tvWrap]}>
      {/* Account & Profile Management Section */}
      <View style={styles.cardSection}>
        <Text style={styles.sectionHeader}>👤 Account & Profiles</Text>
        {s.currentUser ? (
          <View>
            <Text style={styles.userTag}>Signed in as: <Text style={{ color: "#ff6b8b", fontWeight: "700" }}>{s.currentUser.username}</Text></Text>
            
            {/* Active Profiles List */}
            <Text style={styles.subHeader}>Select Active Profile:</Text>
            <View style={styles.optRow}>
              {profiles.map((p) => {
                const isSelected = s.activeProfile?.id === p.id;
                return (
                  <Opt
                    key={p.id}
                    label={`${p.name}${p.is_kids ? " 👶 (Kids)" : ""}`}
                    on={isSelected}
                    onPress={() => selectProfile(p)}
                  />
                );
              })}
            </View>

            {/* Add Profile Drawer */}
            <View style={styles.addProfileBox}>
              <Text style={styles.subHeader}>Create Household Profile:</Text>
              <TextInput
                placeholder="Profile Name (e.g. Kids, Parents)"
                placeholderTextColor="#8fa8b6"
                value={newProfileName}
                onChangeText={setNewProfileName}
                style={styles.input}
              />
              <View style={styles.switchRow}>
                <Text style={styles.optText}>Enable Kids Mode (Family Safe)</Text>
                <Switch
                  value={newProfileIsKids}
                  onValueChange={setNewProfileIsKids}
                  trackColor={{ true: "#ff6b8b" }}
                />
              </View>
              {newProfileIsKids && (
                <TextInput
                  placeholder="Optional 4-digit Parental PIN"
                  placeholderTextColor="#8fa8b6"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  value={newProfilePin}
                  onChangeText={setNewProfilePin}
                  style={[styles.input, { marginTop: 8 }]}
                />
              )}
              <Pressable style={[styles.btn, { marginTop: 10 }]} onPress={handleAddProfile}>
                <Text style={styles.btnText}>+ Add Profile</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.btn, styles.logoutBtn]} onPress={handleLogout}>
              <Text style={styles.btnText}>Sign Out</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.userTag}>Guest Browsing Mode (Account Optional)</Text>
            {authView ? (
              <View style={{ marginTop: 10 }}>
                <Field label="Username" value={usernameInput} onChangeText={setUsernameInput} />
                <Field label="Password" value={passwordInput} onChangeText={setPasswordInput} secureTextEntry />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable style={[styles.btn, styles.primaryBtn]} onPress={handleLogin}>
                    <Text style={styles.btnText}>Sign In</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setAuthView(false)}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={[styles.btn, { marginTop: 8 }]} onPress={() => setAuthView(true)}>
                <Text style={styles.btnText}>Sign In to StreamLab Account</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Language Preferences */}
      <Text style={styles.h}>{t("uiLanguage")}</Text>
      <View style={styles.optRow}>
        {UI_LANGS.map((l) => (
          <Opt key={l.code} label={l.label} on={lang === l.code} onPress={() => setLang(l.code)} />
        ))}
      </View>

      {/* Quality Settings */}
      <Text style={styles.h}>{t("streamQuality")}</Text>
      <View style={styles.optRow}>
        {QUALITIES.map((q) => (
          <Opt key={q.code} label={q.label} on={s.quality === q.code} onPress={() => choose("quality", q.code)} />
        ))}
      </View>

      {/* Low-Bandwidth Data Saver */}
      <View style={styles.switchRow}>
        <View>
          <Text style={styles.optText}>{t("dataSaver")}</Text>
          <Text style={styles.help}>Limits video stream bitrate to ~1.2 Mbps for cellular networks.</Text>
        </View>
        <Switch
          value={!!s.dataSaver}
          onValueChange={(v) => choose("dataSaver", v)}
          trackColor={{ true: "#ff6b8b" }}
        />
      </View>

      {/* Advanced Settings */}
      <Pressable
        onPress={() => setAdv(!adv)}
        accessibilityRole="button"
        style={({ focused }) => [styles.advBtn, focused && styles.focus]}
      >
        <Text style={styles.optText}>{adv ? "▾ " : "▸ "}Advanced & Server Settings</Text>
      </Pressable>

      {adv && (
        <View style={styles.advContainer}>
          <Field
            label="StreamLab Backend Server Address"
            value={s.serverUrl}
            onChangeText={set("serverUrl")}
            placeholder="http://localhost:3000"
          />
          <Field
            label="TMDB API Key (Optional client override)"
            value={s.tmdbKey}
            onChangeText={set("tmdbKey")}
          />
          <Field
            label="Jellyfin Server Address"
            value={s.jfUrl}
            onChangeText={set("jfUrl")}
            placeholder="http://192.168.1.20:8096"
            keyboardType="url"
          />
          <Field label="Jellyfin Username" value={s.jfUser} onChangeText={set("jfUser")} />
          <Field label="Jellyfin Password" value={s.jfPass} onChangeText={set("jfPass")} secureTextEntry />
          
          <Pressable onPress={saveAdvanced} accessibilityRole="button" style={[styles.btn, styles.primaryBtn]}>
            <Text style={styles.btnText}>{t("saveTest")}</Text>
          </Pressable>
          {!!status && <Text style={styles.status}>{status}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#10202b", padding: 20, paddingBottom: 60 },
  tvWrap: { paddingHorizontal: 48, paddingVertical: 24 },
  cardSection: {
    backgroundColor: "#172c3a",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2a4557",
    marginBottom: 20,
  },
  sectionHeader: { color: "#e8f1f5", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  subHeader: { color: "#8fa8b6", fontSize: 14, fontWeight: "600", marginTop: 10, marginBottom: 8 },
  userTag: { color: "#8fa8b6", fontSize: 15, marginBottom: 6 },
  h: { color: "#e8f1f5", fontSize: 20, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  label: { color: "#8fa8b6", marginBottom: 4, fontSize: 15 },
  help: { color: "#8fa8b6", fontSize: 12, marginTop: 2, maxWidth: 260 },
  input: {
    color: "#e8f1f5",
    borderWidth: 2,
    borderColor: "#2a4557",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#10202b",
  },
  optRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  opt: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2a4557",
    backgroundColor: "#172c3a",
  },
  optOn: { backgroundColor: "rgba(255,107,139,0.2)", borderColor: "#ff6b8b" },
  optText: { color: "#e8f1f5", fontSize: 16 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    paddingVertical: 8,
  },
  advBtn: {
    minHeight: 48,
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  advContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: "#132330",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a4557",
  },
  addProfileBox: {
    backgroundColor: "#10202b",
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  btn: {
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#2a4557",
    backgroundColor: "#172c3a",
    paddingHorizontal: 16,
  },
  primaryBtn: { backgroundColor: "#ff6b8b", borderColor: "#ff6b8b" },
  logoutBtn: { borderColor: "#ff4757", marginTop: 12 },
  focus: { borderColor: "#ff6b8b" },
  btnText: { color: "#e8f1f5", fontSize: 15, fontWeight: "700" },
  status: { color: "#ff6b8b", marginTop: 12, fontSize: 15, fontWeight: "600" },
});
