/**
 * Authentication service.
 *
 * Phase 2 provides the login request (needed to establish the local session for
 * the navigation skeleton). Register / OTP / Google OAuth / password reset are
 * Phase 3. Everything here talks to the EXISTING backend endpoints — no new
 * auth system is invented.
 */
import { api, ApiError } from "./api";
import { clearSessionCookie, setSessionCookie } from "./secure-store";
import {
  saveSession,
  clearSession,
  updateLastSyncedAt,
  StoredWorkspace,
} from "@/database/repositories/session";
import { User } from "@/types";
import { nowIso } from "@/utils/date";

export interface LoginResult {
  user: User;
  workspace: StoredWorkspace | null;
}

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const res = await api.post<Record<string, unknown>>("/api/auth/login", { identifier, password });

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
    saveSession({
      user,
      workspace,
      lastSyncedAt: null,
    });
  }

  return { user, workspace };
}

export async function register(input: {
  email?: string;
  phoneNumber?: string;
  password: string;
  name?: string;
  emailOtp?: string;
  phoneOtp?: string;
}): Promise<LoginResult> {
  const res = await api.post<Record<string, unknown>>("/api/auth/register", input);
  if (!res.cookie) {
    throw new ApiError(res.status, "The server did not issue a session cookie.");
  }
  await setSessionCookie(res.cookie);
  const user = res.data as unknown as User;
  return { user, workspace: null };
}

export async function requestOtp(input: {
  email?: string;
  phoneNumber?: string;
  type: "email" | "phone";
}): Promise<{ message: string; expiresIn: number }> {
  const res = await api.post<{ message: string; expiresIn: number }>("/api/auth/request-otp", input);
  return res.data;
}

export async function verifyOtp(input: {
  email?: string;
  phoneNumber?: string;
  type: "email" | "phone";
  otp: string;
}): Promise<{ verified: boolean; message: string }> {
  const res = await api.post<{ verified: boolean; message: string }>("/api/auth/verify-otp", input);
  return res.data;
}

export async function forgotPassword(identifier: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>("/api/auth/forgot-password", { identifier });
  return res.data;
}

export async function resetPassword(input: {
  identifier: string;
  otp: string;
  newPassword: string;
}): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>("/api/auth/reset-password", input);
  return res.data;
}

export async function fetchCurrentUser(): Promise<LoginResult | null> {
  try {
    const res = await api.get<Record<string, unknown>>("/api/user");
    if (res.status === 401) return null;
    const data = res.data;
    if (!data || typeof data !== "object") return null;
    const workspace = data.workspace as unknown;
    const user = data as unknown as User;
    const ws =
      workspace && typeof workspace === "object"
        ? ({
            id: Number((workspace as { workspaceId?: unknown }).workspaceId ?? 0),
            name: String((workspace as { workspaceName?: unknown }).workspaceName ?? ""),
            role: String((workspace as { role?: unknown }).role ?? "viewer"),
            referralCode: String((workspace as { referralCode?: unknown }).referralCode ?? ""),
            adminReferralCode: String(
              (workspace as { adminReferralCode?: unknown }).adminReferralCode ?? "",
            ),
            academicYear: (workspace as { academicYear?: unknown }).academicYear as string | null,
          } as StoredWorkspace)
        : null;
    return { user, workspace: ws };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/logout");
  } catch {
    // Even if the server call fails, the local session must go.
  }
  await clearSessionCookie();
  clearSession();
}

export function markSessionSyncedAt(timestamp?: string): void {
  updateLastSyncedAt(timestamp ?? nowIso());
}
