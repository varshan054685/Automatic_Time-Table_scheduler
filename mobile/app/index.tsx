import { Redirect } from "expo-router";
import { useSession } from "@/hooks/use-session";

export default function Index() {
  const { status } = useSession();
  return <Redirect href={status === "signedIn" ? "/(tabs)" : "/(auth)/login"} />;
}
