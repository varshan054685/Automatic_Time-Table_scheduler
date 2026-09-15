import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { colors, radii, typography } from "@/constants/theme";
import { forgotPassword, resetPassword } from "@/services/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!identifier.trim()) {
      setError("Enter your email or phone number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(identifier.trim());
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!otp.trim() || !newPassword) {
      setError("Enter the code and your new password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword({ identifier: identifier.trim(), otp: otp.trim(), newPassword });
      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll send a code to your email or phone to verify it's you."
    >
      <View style={{ gap: 14 }}>
        {step === "request" ? (
          <>
            <View>
              <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
                EMAIL OR PHONE
              </Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="you@college.edu or +91 98765 43210"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={[inputStyle]}
              />
            </View>
            <View style={{ marginTop: 6 }}>
              <Button
                label="Send reset code"
                onPress={() => void handleRequest()}
                loading={submitting}
                disabled={submitting}
                fullWidth
              />
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
                RESET CODE
              </Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="6-digit code"
                placeholderTextColor={colors.inkMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[inputStyle]}
              />
            </View>
            <View>
              <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
                NEW PASSWORD
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.inkMuted}
                secureTextEntry
                autoCapitalize="none"
                style={[inputStyle]}
              />
            </View>
            <View style={{ marginTop: 6 }}>
              <Button
                label="Reset password"
                onPress={() => void handleReset()}
                loading={submitting}
                disabled={submitting}
                fullWidth
              />
            </View>
          </>
        )}

        {error ? (
          <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 4 }}>
          <Link href="/(auth)/login" style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
            Back to sign in
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
