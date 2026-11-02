import React, { useEffect, useState } from "react";
import { Alert, StatusBar, Text, View, Platform } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import Browse from "./src/screens/Browse";
import Search from "./src/screens/Search";
import Details from "./src/screens/Details";
import Player from "./src/screens/Player";
import Settings from "./src/screens/Settings";
import Welcome from "./src/screens/Welcome";
import LiveTV from "./src/screens/LiveTV";
import { loadDownloads } from "./src/downloads";
import { loadSettings } from "./src/settings";
import { LangProvider, useT, useUiLang } from "./src/i18n";
import { resolveArchiveStream } from "./src/archive";

const isTV = Platform.isTV;

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#10202b",
    card: "#172c3a",
    primary: "#ff6b8b",
    text: "#e8f1f5",
    border: "#2a4557",
  },
};

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function Screen({ children }) {
  const { top } = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingTop: isTV ? 0 : top }}>{children}</View>;
}

const BrowseScreen = ({ navigation }) => (
  <Screen>
    <Browse
      onSelect={(item) => navigation.navigate("Details", { item })}
      onResume={(e) => navigation.navigate("Player", { url: e.url, item: e })}
    />
  </Screen>
);

const SearchScreen = ({ navigation }) => (
  <Screen>
    <Search onSelect={(item) => navigation.navigate("Details", { item })} />
  </Screen>
);

const SettingsScreen = () => (
  <Screen>
    <Settings />
  </Screen>
);

const LiveTVScreen = ({ navigation }) => (
  <Screen>
    <LiveTV
      onSelectChannel={(ch) =>
        navigation.navigate("Player", { url: ch.stream, item: ch })
      }
    />
  </Screen>
);

function DetailsScreen({ route, navigation }) {
  const { item } = route.params;

  const play = async () => {
    // 1. Check if a local offline download exists
    const downloads = await loadDownloads();
    const local = downloads.find((d) => String(d.id) === String(item.id));
    if (local?.url) {
      navigation.navigate("Player", { url: local.url, item });
      return;
    }

    // 2. Check if a direct stream or Jellyfin stream is defined
    if (item.stream) {
      navigation.navigate("Player", { url: item.stream, item });
      return;
    }

    // 3. Check if Internet Archive stream can be resolved
    if (item.archiveId) {
      const archiveUrl = await resolveArchiveStream(item.archiveId);
      if (archiveUrl) {
        navigation.navigate("Player", { url: archiveUrl, item });
        return;
      }
    }

    // 4. Do NOT silently substitute sample test streams. Clearly notify user of OTT metadata status.
    Alert.alert(
      "OTT Discovery Listing",
      "This title is listed for discovery via TMDB metadata and does not have an internal direct video stream. Please check the 'Where to watch in India' section below to view available legal streaming platforms (e.g. Netflix, Prime Video, JioHotstar).",
      [{ text: "OK" }]
    );
  };

  const getDownloadUrl = async () => item.download || (item.archiveId ? resolveArchiveStream(item.archiveId) : null);

  return (
    <Screen>
      <Details item={item} onPlay={play} onBack={() => navigation.goBack()} getDownloadUrl={getDownloadUrl} />
    </Screen>
  );
}

const PlayerScreen = ({ route, navigation }) => (
  <Player url={route.params.url} item={route.params.item} onClose={() => navigation.goBack()} />
);

function Home() {
  const t = useT();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ff6b8b",
        tabBarInactiveTintColor: "#8fa8b6",
        tabBarLabelStyle: { fontSize: isTV ? 18 : 14, fontWeight: "600" },
        tabBarStyle: {
          height: isTV ? 80 : 66,
          paddingBottom: isTV ? 12 : 8,
          paddingTop: 8,
          backgroundColor: "#172c3a",
          borderTopColor: "#2a4557",
          borderTopWidth: 1.5,
        },
      }}
    >
      <Tabs.Screen
        name="Browse"
        component={BrowseScreen}
        options={{
          title: t("browse"),
          tabBarIcon: () => <Text style={{ fontSize: isTV ? 26 : 22 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: t("search"),
          tabBarIcon: () => <Text style={{ fontSize: isTV ? 26 : 22 }}>🔍</Text>,
        }}
      />
      <Tabs.Screen
        name="LiveTV"
        component={LiveTVScreen}
        options={{
          title: "Live TV",
          tabBarIcon: () => <Text style={{ fontSize: isTV ? 26 : 22 }}>📺</Text>,
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t("settings"),
          tabBarIcon: () => <Text style={{ fontSize: isTV ? 26 : 22 }}>⚙️</Text>,
        }}
      />
    </Tabs.Navigator>
  );
}

function Root() {
  const { chosen } = useUiLang();
  if (!chosen) {
    return <Welcome />;
  }
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ animation: "fade" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    loadSettings().then(() => setBooted(true));
  }, []);

  if (!booted) return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <LangProvider>
        <Root />
      </LangProvider>
    </SafeAreaProvider>
  );
}
