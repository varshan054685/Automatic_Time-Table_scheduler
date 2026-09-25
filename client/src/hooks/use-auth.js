import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ensureInstitution, clearInstitutionIdCache } from "@/lib/desktop-api";

/**
 * Local-desktop auth contract (no online accounts — spec §5):
 * useUser() always resolves to a local "owner" user whose workspace is the
 * local institution. Login/OTP/OAuth flows are removed; the hook names are
 * kept so existing pages render unchanged.
 */

const USER_KEY = ["local-user"];

export function useUser() {
  const { data, isLoading, error } = useQuery({
    queryKey: USER_KEY,
    queryFn: async () => {
      const inst = await ensureInstitution();
      const profileName = await window.api.settings.get("profile.name");
      const profileEmail = await window.api.settings.get("profile.email");
      const profilePhone = await window.api.settings.get("profile.phone");
      const profileAvatar = await window.api.settings.get("profile.avatar");
      return {
        id: 1,
        name: (profileName && String(profileName)) || "Local User",
        email: (profileEmail && String(profileEmail)) || "",
        phoneNumber: (profilePhone && String(profilePhone)) || "",
        avatar: (profileAvatar && String(profileAvatar)) || "",
        role: "owner",
        workspace: {
          id: inst.id,
          workspaceName: inst.name,
          role: "owner",
          academicYear: inst.academicYear,
          institutionType: inst.type,
        },
      };
    },
    staleTime: 30_000,
    retry: false,
  });
  return { user: data, isLoading, error };
}

/** Kept for API compatibility — the desktop app has no logout. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => undefined,
    onSuccess: () => {
      queryClient.setQueryData(USER_KEY, null);
    },
  });
}

/** Rename the local institution (Settings → Workspace section). */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }) => {
      const inst = await ensureInstitution();
      return window.api.institutions.update(inst.id, { name });
    },
    onSuccess: () => {
      clearInstitutionIdCache();
      queryClient.invalidateQueries({ queryKey: USER_KEY });
    },
  });
}

/** Switch the active academic year for the local institution. */
export function useSetActiveYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ yearId }) => {
      const inst = await ensureInstitution();
      return window.api.academicYears.activate(inst.id, yearId);
    },
    onSuccess: () => {
      clearInstitutionIdCache();
      queryClient.invalidateQueries({ queryKey: USER_KEY });
    },
  });
}

// ─── Removed cloud flows. Kept as no-op hooks so any lingering imports ────
// ─── fail loudly at runtime instead of silently doing nothing.        ────
function removed(name) {
  return () => {
    throw new Error(`${name} was removed in the offline desktop edition.`);
  };
}

export const useLogin = removed("useLogin");
export const useRegister = removed("useRegister");
export const useRequestOtp = removed("useRequestOtp");
export const useVerifyOtp = removed("useVerifyOtp");
export const useGoogleLogin = removed("useGoogleLogin");
export const useAuthConfig = removed("useAuthConfig");
export const useForgotPassword = removed("useForgotPassword");
export const useResetPassword = removed("useResetPassword");
