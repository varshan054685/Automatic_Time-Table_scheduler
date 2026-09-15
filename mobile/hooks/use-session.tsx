/**
 * Local session context.
 *
 * Boots from SecureStore (cookie presence) + SQLite (user/workspace snapshot)
 * WITHOUT any network request — the app shell renders offline immediately.
 * signIn/signOut mutate both stores together.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { hasSessionCookie } from "@/services/secure-store";
import { loadSession, clearSession as clearLocalSession, saveSession } from "@/database/repositories/session";
import { login as apiLogin, logout as apiLogout } from "@/services/auth";
import { LocalSession, User } from "@/types";
import { nowIso } from "@/utils/date";

type SessionStatus = "loading" | "signedIn" | "signedOut";

interface SessionContextValue {
  status: SessionStatus;
  user: User | null;
  session: LocalSession | null;
  isOwner: boolean;
  signInWithCredentials: (identifier: string, password: string) => Promise<void>;
  signInWithSession: (session: LocalSession) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [session, setSession] = useState<LocalSession | null>(null);

  const hydrate = useCallback(async () => {
    const hasCookie = await hasSessionCookie();
    const local = loadSession();
    if (hasCookie && local) {
      setSession(local);
      setStatus("signedIn");
    } else {
      setSession(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const signInWithCredentials = useCallback(async (identifier: string, password: string) => {
    const result = await apiLogin(identifier, password);
    // If the account has no workspace yet, sign in with an empty workspace
    // placeholder; workspace creation/joining is handled in Phase 3.
    const local: LocalSession = {
      user: result.user,
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
    };
    saveSession(local);
    setSession(local);
    setStatus("signedIn");
  }, []);

  const signInWithSession = useCallback(async (local: LocalSession) => {
    saveSession(local);
    setSession(local);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    clearLocalSession();
    setSession(null);
    setStatus("signedOut");
  }, []);

  const refreshSession = useCallback(async () => {
    const local = loadSession();
    if (local) {
      setSession({ ...local, lastSyncedAt: local.lastSyncedAt ?? nowIso() });
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      isOwner: session?.workspace?.role === "owner",
      signInWithCredentials,
      signInWithSession,
      signOut,
      refreshSession,
    }),
    [status, session, signInWithCredentials, signInWithSession, signOut, refreshSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
