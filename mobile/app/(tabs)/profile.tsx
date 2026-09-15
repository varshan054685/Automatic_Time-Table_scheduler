import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Settings, LogOut, ShieldCheck, Sparkles, Wand2 } from "lucide-react-native";
import { Screen, AppHeader, Card, SyncStatus, StatusBadge } from "@/components";
import { useSession } from "@/hooks/use-session";
import { colors, typography } from "@/constants/theme";
import { formatRelativeTime } from "@/utils/date";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, isOwner, signOut } = useSession();
  const user = session?.user;
  const workspace = session?.workspace;

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Screen scroll padded>
      <AppHeader title="Profile" subtitle="Account & offline session" right={<SyncStatus />} />

      {/* Identity card */}
      <Card className="mb-4">
        <View className="flex-row items-center gap-4">
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.white }}>
              {initials}
            </Text>
          </View>
          <View className="flex-1">
            <Text style={[typography.h3, { color: colors.ink }]} numberOfLines={1}>
              {user?.name ?? "User"}
            </Text>
            <Text style={[typography.caption, { color: colors.inkSecondary, marginTop: 1 }]}>
              {user?.email ?? user?.phoneNumber ?? "—"}
            </Text>
          </View>
        </View>
      </Card>

      {/* Offline session card */}
      <Card className="mb-4">
        <Text style={[typography.label, { color: colors.inkMuted, letterSpacing: 0.6, marginBottom: 10 }]}>
          OFFLINE SESSION
        </Text>
        <View className="gap-2">
          <InfoRow label="Workspace" value={workspace?.name ?? "—"} />
          <InfoRow label="Role" value={isOwner ? "Owner" : "Viewer"} />
          <InfoRow label="Academic year" value={workspace?.academicYear ?? "—"} />
          <InfoRow label="Last synced" value={formatRelativeTime(session?.lastSyncedAt)} />
          <View className="mt-1">
            <StatusBadge label="Offline access available" tone="success" />
          </View>
        </View>
      </Card>

      {/* Actions */}
      <Pressable
        onPress={() => router.push("/generate")}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <Wand2 size={20} color={colors.accent} />
        <Text style={[typography.bodyMedium, { color: colors.ink, flex: 1 }]}>Generate timetable</Text>
        <Text style={{ fontSize: 16, color: colors.inkMuted }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/chat")}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <Sparkles size={20} color={colors.primary} />
        <Text style={[typography.bodyMedium, { color: colors.ink, flex: 1 }]}>AI Assistant</Text>
        <Text style={{ fontSize: 16, color: colors.inkMuted }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <Settings size={20} color={colors.primary} />
        <Text style={[typography.bodyMedium, { color: colors.ink, flex: 1 }]}>Settings</Text>
        <Text style={{ fontSize: 16, color: colors.inkMuted }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => void signOut()}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.dangerSoft,
          padding: 14,
          marginBottom: 24,
        }}
      >
        <LogOut size={20} color={colors.danger} />
        <Text style={[typography.bodyMedium, { color: colors.danger, flex: 1 }]}>Sign out</Text>
      </Pressable>

      <View className="flex-row items-center gap-2 justify-center">
        <ShieldCheck size={14} color={colors.inkMuted} />
        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.inkMuted }}>
          Session cookie stored securely on this device
        </Text>
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text style={[typography.caption, { color: colors.inkSecondary }]}>{label}</Text>
      <Text style={[typography.captionMedium, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
