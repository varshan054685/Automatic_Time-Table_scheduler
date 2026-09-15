import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react-native";
import { useSyncStatusSnapshot } from "@/services/connectivity";
import { formatRelativeTime } from "@/utils/date";
import { colors } from "@/constants/theme";

interface SyncStatusProps {
  /** Compact pill for headers; `bar` renders a full-width strip. */
  variant?: "pill" | "bar";
  onRetry?: () => void;
}

/**
 * Offline-aware sync indicator. Subtle by design — offline is a normal app
 * state, not an error. `lastSyncedAt` is populated by the Phase 6 sync engine.
 */
export function SyncStatus({ variant = "pill", onRetry }: SyncStatusProps) {
  const snapshot = useSyncStatusSnapshot();

  const render = () => {
    switch (snapshot.state) {
      case "online":
        return (
          <SyncRow
            icon={<Wifi size={14} color={colors.success} />}
            label="Online"
            tint={colors.success}
          />
        );
      case "offline":
        return (
          <SyncRow
            icon={<WifiOff size={14} color={colors.inkSecondary} />}
            label="Offline"
            tint={colors.inkSecondary}
          />
        );
      case "syncing":
        return (
          <SyncRow
            icon={<ActivityIndicator size={12} color={colors.primary} />}
            label="Syncing…"
            tint={colors.primary}
          />
        );
      case "sync_failed":
        return (
          <SyncRow
            icon={<AlertCircle size={14} color={colors.danger} />}
            label={onRetry ? "Sync failed — tap to retry" : "Sync failed"}
            tint={colors.danger}
          />
        );
      default:
        return (
          <SyncRow
            icon={<RefreshCw size={14} color={colors.inkMuted} />}
            label={
              snapshot.lastSyncedAt
                ? `Last synced ${formatRelativeTime(snapshot.lastSyncedAt)}`
                : "Not synced yet"
            }
            tint={colors.inkMuted}
          />
        );
    }
  };

  if (variant === "bar") {
    return (
      <Pressable
        disabled={!onRetry || snapshot.state !== "sync_failed"}
        onPress={onRetry}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: "transparent",
        }}
      >
        {render()}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.line,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      {render()}
    </View>
  );
}

function SyncRow({
  icon,
  label,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
}) {
  return (
    <>
      {icon}
      <Text style={{ fontSize: 11, fontWeight: "700", color: tint, letterSpacing: 0.1 }}>
        {label}
      </Text>
    </>
  );
}
