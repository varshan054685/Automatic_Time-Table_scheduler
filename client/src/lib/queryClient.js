import { QueryClient } from "@tanstack/react-query";

/**
 * Local-only React Query client.
 *
 * Every query goes through window.api.* (Electron IPC) and defines its own
 * queryFn, so there is no HTTP default and no API base URL anywhere in the
 * renderer. Mutations are user-triggered; refetching is driven by explicit
 * invalidation, which is instant against the local database.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
