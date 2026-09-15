import { useState } from "react";
import { FlatList, View, Text } from "react-native";
import { ClipboardList } from "lucide-react-native";
import { Screen, AppHeader, Card, EmptyState, SyncStatus, StatusBadge, Button } from "@/components";
import { colors, typography } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useChangeRequests } from "@/hooks/use-local-data";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useConnectivity } from "@/services/connectivity";
import { ChangeRequest } from "@/types";

export default function RequestsScreen() {
  const { isOwner } = useSession();
  const { isOnline } = useConnectivity();
  const { data: requests } = useChangeRequests();
  const queryClient = useQueryClient();

  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (request: ChangeRequest, action: "approve" | "reject") => {
    if (!isOnline) {
      setError("Approving or rejecting a request needs an internet connection.");
      return;
    }
    setBusyId(Number(request.id));
    setError(null);
    try {
      // Use the SERVER id — local rows carry it as serverId.
      const serverId = Number((request as ChangeRequest & { serverId?: number }).serverId ?? request.id);
      await api.post(`/api/change-requests/${serverId}/${action}`);
      await queryClient.invalidateQueries({ queryKey: ["local"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader title="Requests" subtitle="Change requests from workspace members" right={<SyncStatus />} />

      <FlatList
        data={requests ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          <EmptyState
            icon={<ClipboardList size={26} color={colors.primary} />}
            title="No requests"
            message="Viewer edits and deletes show up here for the owner to review."
          />
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            isOwner={isOwner}
            busy={busyId === Number(item.id)}
            onApprove={() => void decide(item, "approve")}
            onReject={() => void decide(item, "reject")}
          />
        )}
      />

      {error ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <StatusBadge label={error} tone="danger" />
        </View>
      ) : null}
    </Screen>
  );
}

function RequestCard({
  request,
  isOwner,
  busy,
  onApprove,
  onReject,
}: {
  request: ChangeRequest;
  isOwner: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = request.status === "pending";
  const data = request.data ?? {};
  const changes = data.changes as Record<string, unknown> | undefined;

  return (
    <Card className="mb-2.5" padded={false}>
      <View className="px-4 py-3.5">
        <View className="flex-row items-center gap-2 mb-1">
          <StatusBadge
            label={String(request.status)}
            tone={pending ? "warning" : request.status === "approved" ? "success" : "neutral"}
          />
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.inkMuted }}>
            {String(data.table ?? "")} · #{String(data.id ?? "")}
          </Text>
        </View>
        <Text style={[typography.bodyMedium, { color: colors.ink }]}>
          {request.type === "delete" ? "Delete record" : "Edit record"}
          {request.requesterName ? ` — requested by ${request.requesterName}` : ""}
        </Text>
        {changes ? (
          <View className="mt-2">
            {Object.entries(changes).slice(0, 4).map(([k, v]) => (
              <View key={k} className="flex-row justify-between">
                <Text style={[typography.caption, { color: colors.inkSecondary }]}>{k}</Text>
                <Text style={[typography.captionMedium, { color: colors.ink }]} numberOfLines={1}>
                  {String(v ?? "—")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {isOwner && pending ? (
          <View className="flex-row gap-2 mt-3">
            <Button
              label="Approve"
              size="sm"
              variant="secondary"
              onPress={onApprove}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              label="Reject"
              size="sm"
              variant="outline"
              onPress={onReject}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        {!pending ? (
          <View className="mt-2">
            <StatusBadge
              label={request.status === "approved" ? "Applied" : "Not applied"}
              tone={request.status === "approved" ? "success" : "neutral"}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
