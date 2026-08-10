"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,           // Keep unused data for 5 min
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,          // Refetch when internet reconnects
        refetchOnMount: true,
        retry: 3,                          // Retry failed requests 3 times
        retryDelay: (attemptIndex) =>      // Exponential backoff: 1s, 2s, 4s
          Math.min(1000 * 2 ** attemptIndex, 30000),
        retryOnMount: true,                // Retry on component remount if failed
        networkMode: "offlineFirst",       // Queue requests when offline
      },
      mutations: {
        retry: 1,                          // Retry mutations once
        retryDelay: 1000,
        networkMode: "offlineFirst",
      },
    },
  });
}

// Singleton for server-side, per-request for client-side
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();              // Always new instance on server
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient(); // Reuse on client
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}