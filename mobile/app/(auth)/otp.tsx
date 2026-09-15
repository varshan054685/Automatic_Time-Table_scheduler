import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { colors, radii, typography } from "@/constants/theme";
import { requestOtp, verifyOtp } from "@/services/auth";

/**
 * Standalone OTP verification. Registration and password reset embed their own
 * OTP steps; this route is a fallback for users who arrive here directly.
 */
export default function OtpScreen() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const mode: "email" | "phone" = "email";
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    if (!identifier.trim()) {
      setError("Enter your email or phone number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(
        mode === "email"
          ? { email: identifier.trim(), type: "email" }
          : { phoneNumber: identifier.trim(), type: "phone" },
      );
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!otp.trim()) {
      setError("Enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await verifyOtp(
        mode === "email"
          ? { email: identifier.trim(), type: "email", otp: otp.trim() }
          : { phoneNumber: identifier.trim(), type: "phone", otp: otp.trim() },
      );
      if (res.verified) {
        router.replace("/(auth)/register");
      } else {
        setError(res.message || "Verification failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Verify your identity" subtitle="Enter the code we sent you.">
      <View style={{ gap: 14 }}>
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

        {!otpSent ? (
          <View style={{ marginTop: 6 }}>
            <Button
              label="Send code"
              onPress={() => void handleSend()}
              loading={submitting}
              disabled={submitting}
              fullWidth
            />
          </View>
        ) : (
          <>
            <View>
              <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
                VERIFICATION CODE
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
            <View style={{ marginTop: 6 }}>
              <Button
                label="Verify code"
                onPress={() => void handleVerify()}
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
