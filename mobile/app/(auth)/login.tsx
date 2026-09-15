import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { colors, radii, typography } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { signInWithGoogle, isGoogleConfigured } from "@/services/google";
import { StoredWorkspace } from "@/database/repositories/session";
import { User } from "@/types";

/**
 * Login: authenticates against the existing /api/auth/login endpoint with the
 * Passport session cookie, then persists the cookie (SecureStore) + user/
 * workspace (SQLite) so the app opens offline. Google OAuth uses the mobile
 * ID-token exchange endpoint (/api/auth/google/mobile).
 */
export default function LoginScreen() {
  const router = useRouter();
  const { signInWithCredentials, signInWithSession } = useSession();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const enterApp = async (result: {
    user: { id: number; name?: string | null; email?: string | null; role?: string | null };
    workspace: StoredWorkspace | null;
  }) => {
    await signInWithSession({
      user: result.user as User,
      workspace: result.workspace ?? {
        id: 0,
        name: "",
        ownerId: result.user.id,
        referralCode: "",
        adminReferralCode: "",
        academicYear: null,
        role: "viewer",
      },
      lastSyncedAt: null,
    });
    router.replace("/(tabs)");
  };

  const handleSubmit = async () => {
    if (!identifier.trim() || !password) {
      setError("Enter your email or phone number and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await signInWithCredentials(identifier.trim(), password);
      await enterApp(result as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      await enterApp(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const showGoogle = isGoogleConfigured();

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your account to load your workspace onto this device."
    >
      <View style={{ gap: 14 }}>
        {showGoogle ? (
          <>
            <Button
              label="Continue with Google"
              onPress={() => void handleGoogle()}
              variant="outline"
              loading={submitting}
              disabled={submitting}
              fullWidth
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
              <Text style={[typography.caption, { color: colors.inkMuted }]}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            </View>
          </>
        ) : null}

        <View>
          <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
            EMAIL OR PHONE
          </Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@college.edu"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            style={[inputStyle]}
          />
        </View>

        <View>
          <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
            PASSWORD
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.inkMuted}
            secureTextEntry
            autoCapitalize="none"
            style={[inputStyle]}
            onSubmitEditing={() => void handleSubmit()}
          />
        </View>

        {error ? (
          <Text style={[typography.caption, { color: colors.danger, marginTop: 2 }]}>{error}</Text>
        ) : null}

        <View style={{ marginTop: 6 }}>
          <Button
            label="Sign in"
            onPress={() => void handleSubmit()}
            loading={submitting}
            disabled={submitting}
            fullWidth
          />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Link href="/(auth)/forgot-password" style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
            Forgot password?
          </Link>
          <Link href="/(auth)/register" style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
            Create account
          </Link>
        </View>
      </View>
    </AuthShell>
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
