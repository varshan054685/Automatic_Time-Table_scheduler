import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";

export function useUser() {
  const { data, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.auth.me.path), { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
    retry: false,
  });
  return { user: data, isLoading, error };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials) => {
      const res = await fetch(apiUrl(api.auth.login.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const error = new Error(data.message || "Login failed");
        error.field = data.field;
        throw error;
      }
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.auth.register.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch(apiUrl(api.auth.logout.path), { 
        method: "POST",
        credentials: "include" 
      });
    },
    onSuccess: () => {
      // Clear timetable selections so next login starts fresh
      localStorage.removeItem("tt_selectedDept");
      localStorage.removeItem("tt_selectedSection");
      localStorage.removeItem("tt_selectedFaculty");
      queryClient.setQueryData([api.auth.me.path], null);
    },
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.auth.requestOtp.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to send OTP");
      }
      return await res.json();
    },
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.auth.verifyOtp.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "OTP verification failed");
      }
      return await res.json();
    },
  });
}

export function useGoogleLogin() {
  return () => {
    window.location.href = apiUrl(api.auth.googleLogin.path);
  };
}

export function useAuthConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/config"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/auth/config"));
      if (!res.ok) throw new Error("Failed to fetch auth config");
      return await res.json();
    },
    retry: false,
  });
  return { config: data, isLoading };
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to send reset code");
      }
      return await res.json();
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to reset password");
      }
      return await res.json();
    },
  });
}

