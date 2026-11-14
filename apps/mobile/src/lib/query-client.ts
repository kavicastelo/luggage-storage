import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack QueryClient for Expo Mobile.
 * Cleared explicitly on sign-out and account switch to guarantee zero cross-account cache leakage.
 */
export const mobileQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 0
    }
  }
});

