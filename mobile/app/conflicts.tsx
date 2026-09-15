import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Server, Smartphone } from "lucide-react-native";
import {
  Screen,
  AppHeader,
  Card,
  Button,
  EmptyState,
  StatusBadge,
} from "@/components";
import { colors, typography } from "@/constants/theme";
import { useQueryClient } from "@tanstack/react-query";
import {
  listConflicts,
  resolveConflictServerWins,
  resolveConflictLocalWins,
  dismissConflict,
  ConflictView,
} from "@/sync/conflict-resolution";
import { useSyncEngine } from "@/hooks/use-sync";

export default function ConflictsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { sync } = useSyncEngine();
  const [refresh, setRefresh] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  const conflicts = listConflicts();

  const after = async () => {
    setRefresh((r) => r + 1);
    await queryClient.invalidateQueries({ queryKey: ["local"] });
  };

  const handleServerWins = async (conflict: ConflictView) => {
    setBusyId(conflict.item.id);
    resolveConflictServerWins(conflict.item.id);
    await after();
    setBusyId(null);
  };

  const handleLocalWins = async (conflict: ConflictView) => {
    setBusyId(conflict.item.id);
    resolveConflictLocalWins(conflict.item.id);
    await after();
    setBusyId(null);
    // Push the re-queued local change immediately when online.
    await sync();
    await after();
  };

  const handleDismiss = async (conflict: ConflictView) => {
    setBusyId(conflict.item.id);
    dismissConflict(conflict.item.id);
    await after();
    setBusyId(null);
  };

  const entityLabel = (entity: string) =>
    entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Screen padded={false}>
      <AppHeader
        title="Sync conflicts"
        subtitle="Your offline changes vs. what's on the server"
        right={
          <Text
            onPress={() => router.back()}
            style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}
          >
            Done
          </Text>
        }
      />

      <FlatList
        data={conflicts}
        keyExtractor={(c) => String(c.item.id)}
        extraData={refresh}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          <EmptyState
            icon={<Server size={26} color={colors.success} />}
            title="No conflicts"
            message="When the server detects a version mismatch with an offline change, it will appear here for you to resolve."
          />
        }
        renderItem={({ item }) => (
          <Card className="mb-3" padded={false}>
            <View className="px-4 py-4">
              <View className="flex-row items-center gap-2 mb-2">
                <StatusBadge label="Conflict" tone="danger" />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.inkMuted }}>
                  {entityLabel(item.item.entityType)} · {item.item.operation.toLowerCase()}
                </Text>
              </View>

              <Text style={[typography.caption, { color: colors.inkSecondary, marginBottom: 10 }]}>
                {item.snapshot?.message ?? "The server has a newer version of this record."}
              </Text>

              {/* Local payload preview */}
              {item.item.payload ? (
                <View
                  style={{
                    backgroundColor: colors.canvas,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 10,
                  }}
                >
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Smartphone size={12} color={colors.primary} />
                    <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 0.5 }}>
                      YOUR LOCAL CHANGE
                    </Text>
                  </View>
                  <PayloadLines payload={item.item.payload} />
                </View>
              ) : null}

              {/* Server payload preview */}
              {item.snapshot?.serverRow ? (
                <View
                  style={{
                    backgroundColor: colors.canvas,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 12,
                  }}
                >
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Server size={12} color={colors.accent} />
                    <Text style={{ fontSize: 10, fontWeight: "800", color: colors.accent, letterSpacing: 0.5 }}>
                      SERVER VERSION {item.snapshot.serverVersion ?? ""}
                    </Text>
                  </View>
                  <PayloadLines payload={item.snapshot.serverRow} />
                </View>
              ) : null}

              <View className="gap-2">
                <Button
                  label="Use server version"
                  variant="secondary"
                  size="sm"
                  loading={busyId === item.item.id}
                  disabled={busyId != null}
                  onPress={() => void handleServerWins(item)}
                />
                <View className="flex-row gap-2">
                  <Button
                    label="Keep my change"
                    variant="outline"
                    size="sm"
                    disabled={busyId != null}
                    onPress={() => void handleLocalWins(item)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Discard"
                    variant="ghost"
                    size="sm"
                    disabled={busyId != null}
                    onPress={() => void handleDismiss(item)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

function PayloadLines({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([k]) => !k.startsWith("__"));
  if (entries.length === 0) return <Text style={{ fontSize: 12, color: colors.inkMuted }}>No changes</Text>;
  return (
    <View className="gap-0.5">
      {entries.slice(0, 6).map(([k, v]) => (
        <View key={k} className="flex-row justify-between">
          <Text style={[typography.caption, { color: colors.inkSecondary }]}>{k}</Text>
          <Text style={[typography.captionMedium, { color: colors.ink }]} numberOfLines={1}>
            {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
          </Text>
        </View>
      ))}
    </View>
  );
}
