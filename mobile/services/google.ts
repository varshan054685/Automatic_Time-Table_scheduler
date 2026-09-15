/**
 * Google OAuth (mobile).
 *
 * The browser redirect flow used by the web app cannot run on native, so the
 * mobile app obtains a Google ID token via expo-auth-session and exchanges it
 * with the backend's JSON endpoint (POST /api/auth/google/mobile). The server
 * verifies the token, links/creates the user, and returns the same
 * session-cookie login as the web flow — no OAuth secrets ever touch the
 * device, and no JWT system is invented.
 *
 * SDK 57 note: expo-auth-session's GoogleAuthRequest provider is deprecated.
 * We use the generic AuthRequest with Google's discovery document and the
 * ID-token response type, which is the supported path.
 *
 * Env (mobile/.env):
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID   — Android web client / iOS client id
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 *   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
 */
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { api } from "./api";
import { setSessionCookie } from "./secure-store";
import { saveSession, StoredWorkspace } from "@/database/repositories/session";
import { User } from "@/types";
import { ApiError } from "./api";

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  (Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);

// Google's OAuth discovery endpoints (authorize + token).
const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export interface GoogleLoginResult {
  user: User;
  workspace: StoredWorkspace | null;
}

/**
 * Run the Google sign-in flow and exchange the resulting ID token with the
 * backend. Returns the logged-in user + workspace (same shape as login).
 */
export async function signInWithGoogle(): Promise<GoogleLoginResult> {
  if (!CLIENT_ID) {
    throw new Error("Google sign-in is not configured on this device.");
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "timetable" });
  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    scopes: ["openid", "profile", "email"],
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: true,
    extraParams: { nonce: undefined as unknown as string },
  });
  // The nonce parameter is added by expo-auth-session automatically; avoid
  // passing an invalid empty value.
  (request as unknown as { extraParams: Record<string, string> }).extraParams = {};

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== "success") {
    throw new Error(
      result.type === "cancel" ? "Google sign-in was cancelled." : "Google sign-in could not complete.",
    );
  }

  const idToken = result.params?.id_token;
  if (!idToken) {
    throw new Error("Google did not return an identity token.");
  }

  const res = await api.post<Record<string, unknown>>("/api/auth/google/mobile", { idToken });
  if (!res.cookie) {
    throw new ApiError(res.status, "The server did not issue a session cookie.");
  }
  await setSessionCookie(res.cookie);

  const user = res.data as unknown as User;
  const workspaceRaw = res.data.workspace;
  const workspace =
    workspaceRaw && typeof workspaceRaw === "object"
      ? ({
          id: Number((workspaceRaw as { workspaceId?: unknown }).workspaceId ?? 0),
          name: String((workspaceRaw as { workspaceName?: unknown }).workspaceName ?? ""),
          role: String((workspaceRaw as { role?: unknown }).role ?? "viewer"),
          referralCode: String((workspaceRaw as { referralCode?: unknown }).referralCode ?? ""),
          adminReferralCode: String(
            (workspaceRaw as { adminReferralCode?: unknown }).adminReferralCode ?? "",
          ),
          academicYear: (workspaceRaw as { academicYear?: unknown }).academicYear as string | null,
        } as StoredWorkspace)
      : null;

  if (workspace) {
    saveSession({ user, workspace, lastSyncedAt: null });
  }

  return { user, workspace };
}
