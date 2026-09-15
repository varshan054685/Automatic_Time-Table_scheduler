import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Smartphone, Database, RefreshCw, AlertTriangle, ChevronRight } from "lucide-react-native";
import { Screen, AppHeader, Card, SectionHeader, SyncStatus, Button } from "@/components";
import { useSession } from "@/hooks/use-session";
import { useDbStats, useConflictCount } from "@/hooks/use-local-data";
import { useSyncEngine } from "@/hooks/use-sync";
import { useConnectivity } from "@/services/connectivity";
import { colors, typography } from "@/constants/theme";
import { formatRelativeTime, formatDateTime } from "@/utils/date";

export default function SettingsScreen() {
  const router = useRouter();
  const { session, isOwner } = useSession();
  const { data: stats } = useDbStats();
  const { syncing, sync } = useSyncEngine();
  const { isOnline } = useConnectivity();
  const { data: conflictCount = 0 } = useConflictCount();
  const workspace = session?.workspace;

  const handleSyncNow = async () => {
    if (!isOnline) return;
    await sync();
  };

  return (
    <Screen padded>
      <AppHeader title="Settings" subtitle="Offline session & sync" right={<SyncStatus />} />

      {/* Sync actions */}
      <SectionHeader title="Synchronization" />

      <Card className="mb-4">
        <View className="flex-row items-center gap-3 mb-3">
          <RefreshCw size={18} color={colors.primary} />
          <Text style={[typography.bodyMedium, { color: colors.ink, flex: 1 }]}>
            {isOnline ? "Sync now" : "Offline — sync paused"}
          </Text>
          <Button
            label={syncing ? "Syncing…" : "Sync"}
            size="sm"
            loading={syncing}
            disabled={!isOnline || syncing}
            onPress={() => void handleSyncNow()}
          />
        </View>
        <Text style={[typography.caption, { color: colors.inkSecondary }]}>
          {syncing
            ? "Uploading your changes and downloading remote updates…"
            : "The app syncs automatically when you reconnect. Use this to sync on demand."}
        </Text>
      </Card>

      {conflictCount > 0 ? (
        <Pressable
          onPress={() => router.push("/conflicts")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.dangerSoft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.danger,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.danger }]}>
              {conflictCount} sync conflict{conflictCount > 1 ? "s" : ""}
            </Text>
            <Text style={[typography.caption, { color: colors.danger }]}>
              Your offline changes need a decision.
            </Text>
          </View>
          <ChevronRight size={16} color={colors.danger} />
        </Pressable>
      ) : null}

      <SectionHeader title="Offline session" />

      <Card className="mb-4">
        <View className="gap-2">
          <InfoRow label="Workspace" value={workspace?.name ?? "—"} />
          <InfoRow label="Role" value={isOwner ? "Owner" : "Viewer"} />
          <InfoRow label="Last synced" value={formatRelativeTime(session?.lastSyncedAt)} />
          <InfoRow
            label="Last sync (absolute)"
            value={formatDateTime(session?.lastSyncedAt)}
          />
        </View>
      </Card>

      <Card className="mb-4">
        <View className="flex-row items-center gap-3 mb-2">
          <Smartphone size={18} color={colors.inkMuted} />
          <Text style={[typography.bodyMedium, { color: colors.ink }]}>Device</Text>
        </View>
        <Text style={[typography.caption, { color: colors.inkSecondary }]}>
          The app opens immediately with locally synchronized data when offline. An offline-session
          expiry policy can be added later without architecture changes.
        </Text>
      </Card>

      <SectionHeader title="Local database" />

      <Card>
        <View className="flex-row items-center gap-3 mb-2">
          <Database size={18} color={colors.inkMuted} />
          <Text style={[typography.bodyMedium, { color: colors.ink }]}>Storage</Text>
        </View>
        <InfoRow label="Database size" value={formatBytes(stats?.dbSizeBytes ?? 0)} />
        <InfoRow label="Pending offline ops" value={String(stats?.pendingOpCount ?? 0)} />
        <InfoRow label="Sync conflicts" value={String(conflictCount)} />
        <View className="mt-2">
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.inkMuted }}>
            The sync engine uploads queued changes and downloads remote updates
            automatically when the device is back online.
          </Text>
        </View>
      </Card>

      <View className="mt-8 items-center">
        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.inkMuted }}>
          Timetable Mobile v0.1.0 — offline-first
        </Text>
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text style={[typography.caption, { color: colors.inkSecondary }]}>{label}</Text>
      <Text style={[typography.captionMedium, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
