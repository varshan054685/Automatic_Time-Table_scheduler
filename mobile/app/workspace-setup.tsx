import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Building2, Link2 } from "lucide-react-native";
import { Screen, AppHeader, Card, Button, StatusBadge } from "@/components";
import { colors, radii, typography } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { api } from "@/services/api";
import { saveSession, StoredWorkspace } from "@/database/repositories/session";

/**
 * Workspace setup — create a new workspace or join via referral code.
 * Both endpoints are the existing backend ones (POST /api/workspaces,
 * POST /api/workspaces/join). Requires an internet connection (first-time
 * provisioning); after joining, the sync engine downloads the data offline.
 */
export default function WorkspaceSetupScreen() {
  const router = useRouter();
  const { session, signInWithSession } = useSession();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const adoptWorkspace = async (wsRaw: {
    id?: number;
    name?: string;
    ownerId?: number;
    referralCode?: string;
    adminReferralCode?: string;
    academicYear?: string | null;
  }, role: "owner" | "viewer") => {
    const workspace: StoredWorkspace = {
      id: Number(wsRaw.id ?? 0),
      name: String(wsRaw.name ?? ""),
      ownerId: Number(wsRaw.ownerId ?? session?.user.id ?? 0),
      referralCode: String(wsRaw.referralCode ?? ""),
      adminReferralCode: String(wsRaw.adminReferralCode ?? ""),
      academicYear: wsRaw.academicYear ?? null,
      role,
    };
    const local = {
      user: session!.user,
      workspace,
      lastSyncedAt: null,
    };
    saveSession(local);
    await signInWithSession(local);
    router.replace("/(tabs)");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Give your workspace a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id?: number; name?: string; ownerId?: number; referralCode?: string; adminReferralCode?: string; academicYear?: string | null }>(
        "/api/workspaces",
        { name: name.trim() },
      );
      await adoptWorkspace(res.data, "owner");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) {
      setError("Enter the referral code from your workspace admin.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ workspace?: { id?: number; name?: string; ownerId?: number; referralCode?: string; adminReferralCode?: string; academicYear?: string | null }; member?: { role?: string } }>(
        "/api/workspaces/join",
        { referralCode: code.trim() },
      );
      await adoptWorkspace(res.data.workspace ?? {}, res.data.member?.role === "owner" ? "owner" : "viewer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded>
      <AppHeader
        title="Set up your workspace"
        subtitle="You need a workspace before you can load timetables."
      />

      <Card className="mb-4">
        <View className="flex-row items-center gap-3 mb-1">
          <Building2 size={20} color={colors.primary} />
          <Text style={[typography.h3, { color: colors.ink }]}>Create a workspace</Text>
        </View>
        <Text style={[typography.caption, { color: colors.inkSecondary, marginBottom: 12 }]}>
          You'll be the owner and can add departments, faculty, and generate timetables.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. ABC College of Engineering"
          placeholderTextColor={colors.inkMuted}
          style={[inputStyle, { marginBottom: 12 }]}
        />
        <Button
          label="Create workspace"
          onPress={() => void handleCreate()}
          loading={submitting}
          disabled={submitting}
          fullWidth
        />
      </Card>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <Text style={[typography.caption, { color: colors.inkMuted }]}>OR</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>

      <Card>
        <View className="flex-row items-center gap-3 mb-1">
          <Link2 size={20} color={colors.accent} />
          <Text style={[typography.h3, { color: colors.ink }]}>Join with a code</Text>
        </View>
        <Text style={[typography.caption, { color: colors.inkSecondary, marginBottom: 12 }]}>
          Ask your workspace owner for the referral code.
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g. A1B2C3D4"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[inputStyle, { marginBottom: 12 }]}
        />
        <Button
          label="Join workspace"
          onPress={() => void handleJoin()}
          variant="secondary"
          loading={submitting}
          disabled={submitting}
          fullWidth
        />
      </Card>

      {error ? (
        <View className="mt-4">
          <StatusBadge label={error} tone="danger" />
        </View>
      ) : null}
    </Screen>
  );
}

const inputStyle = {
  height: 48,
  borderRadius: radii.md,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.surface,
  paddingHorizontal: 14,
  fontSize: 15,
  color: colors.ink,
} as const;
