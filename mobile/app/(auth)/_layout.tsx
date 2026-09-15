import { Stack } from "expo-router";
import { useSession } from "@/hooks/use-session";

export default function AuthLayout() {
  const { status } = useSession();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Signed-in users should never land on the auth screens. */}
      <Stack.Protected guard={status !== "signedIn"}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}
