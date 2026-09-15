import "../global.css";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import { AppProviders } from "@/providers/AppProviders";
import { useSession } from "@/hooks/use-session";
import { colors, typography } from "@/constants/theme";
import { getDb } from "@/database/sqlite";

// Open + migrate SQLite as early as possible so the first screen render is ready.
getDb();

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, marginBottom: 14 }} />
      <Text style={[typography.bodyMedium, { color: colors.inkSecondary }]}>Timetable Mobile</Text>
    </View>
  );
}

function RootNavigator() {
  const { status } = useSession();

  // Do not render the router until the local session has been hydrated from
  // SecureStore + SQLite — avoids a flash of the wrong route.
  if (status === "loading") return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="workspace-setup" />
      <Stack.Screen name="data/[entity]/index" />
      <Stack.Screen name="data/[entity]/form" />
      <Stack.Screen name="generate/index" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="conflicts" />
      <Stack.Screen
        name="settings/index"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.canvas },
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 17, fontWeight: "700", color: colors.ink },
          headerTintColor: colors.primary,
          title: "Settings",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <RootNavigator />
        <StatusBar style="dark" />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
