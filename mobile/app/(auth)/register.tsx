import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { colors, radii, typography } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { requestOtp, verifyOtp, register } from "@/services/auth";

export default function RegisterScreen() {
  const router = useRouter();
  const { signInWithSession } = useSession();

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const identifier = mode === "email" ? email.trim() : phone.trim();

  const handleRequestOtp = async () => {
    if (!identifier) {
      setError(mode === "email" ? "Enter your email address." : "Enter your phone number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(mode === "email" ? { email: identifier, type: "email" } : { phoneNumber: identifier, type: "phone" });
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError("Enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await verifyOtp(
        mode === "email" ? { email: identifier, type: "email", otp: otp.trim() } : { phoneNumber: identifier, type: "phone", otp: otp.trim() },
      );
      if (res.verified) {
        setOtpVerified(true);
      } else {
        setError(res.message || "Verification failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!identifier || !password) {
      setError("Fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await register({
        ...(mode === "email" ? { email: identifier, emailOtp: otp.trim() } : { phoneNumber: identifier, phoneOtp: otp.trim() }),
        password,
        name: name.trim() || undefined,
      });
      // Sign in with the (possibly empty) session so the app lands on the
      // workspace create/join screen instead of the auth group.
      const local = {
        user: result.user,
        workspace: result.workspace ?? {
          id: 0,
          name: "",
          ownerId: result.user.id,
          referralCode: "",
          adminReferralCode: "",
          academicYear: null,
          role: "viewer" as const,
        },
        lastSyncedAt: null,
      };
      await signInWithSession(local);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Verify your identity, then set up your workspace."
    >
      <View style={{ gap: 14 }}>
        {/* Identifier */}
        <View>
          <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>
            I'LL REGISTER WITH
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["email", "phone"] as const).map((m) => (
              <Button
                key={m}
                label={m === "email" ? "Email" : "Phone"}
                variant={mode === m ? "secondary" : "outline"}
                size="sm"
                onPress={() => {
                  setMode(m);
                  setOtpSent(false);
                  setOtpVerified(false);
                  setOtp("");
                }}
              />
            ))}
          </View>
        </View>

        {mode === "email" ? (
          <View>
            <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={[inputStyle]}
            />
          </View>
        ) : (
          <View>
            <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>PHONE NUMBER</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.inkMuted}
              keyboardType="phone-pad"
              style={[inputStyle]}
            />
          </View>
        )}

        <View>
          <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>FULL NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Prof. Jane Doe"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="words"
            style={[inputStyle]}
          />
        </View>

        <View>
          <Text style={[typography.label, { color: colors.inkSecondary, marginBottom: 6 }]}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.inkMuted}
            secureTextEntry
            autoCapitalize="none"
            style={[inputStyle]}
          />
        </View>

        {!otpSent ? (
          <View style={{ marginTop: 6 }}>
            <Button
              label="Send verification code"
              onPress={() => void handleRequestOtp()}
              loading={submitting}
              disabled={submitting}
              fullWidth
            />
          </View>
        ) : !otpVerified ? (
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
                onPress={() => void handleVerifyOtp()}
                loading={submitting}
                disabled={submitting}
                fullWidth
              />
            </View>
          </>
        ) : (
          <View style={{ marginTop: 6 }}>
            <Button
              label="Create account"
              onPress={() => void handleRegister()}
              loading={submitting}
              disabled={submitting || !password}
              fullWidth
            />
          </View>
        )}

        {error ? (
          <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 4 }}>
          <Text style={[typography.caption, { color: colors.inkSecondary }]}>
            Already have an account?{" "}
            <Link href="/(auth)/login" style={{ fontWeight: "700", color: colors.primary }}>
              Sign in
            </Link>
          </Text>
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
