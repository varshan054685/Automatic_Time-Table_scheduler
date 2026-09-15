import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/hooks/use-session";
import { useSyncEngine } from "@/hooks/use-sync";

/**
 * Provider composition for the app.
 *
 * The QueryClient here serves cached mirrors of local SQLite reads; the sync
 * engine invalidates these keys after writes. Retry/stale settings are
 * conservative so the app never hammers the network.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Kick-starts the sync engine once the provider tree is mounted. */
function SyncEngine() {
  useSyncEngine();
  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createAppQueryClient()}>
      <SessionProvider>
        <SyncEngine />
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
