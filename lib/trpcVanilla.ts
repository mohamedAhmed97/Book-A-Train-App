import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@bat/api";
import { useAuthStore } from "@/stores/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/trpc";

/**
 * Non-React tRPC client for code that runs outside the component tree — the
 * vitals streamer polls and uploads on a timer, so it has no hooks available.
 *
 * Cast to `any` for the same reason as `lib/trpc.ts`: the shared @bat/api
 * package is a stub, so procedure types don't resolve.
 */
export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      // Read the token per request so a re-login is picked up immediately.
      headers: () => {
        const token = useAuthStore.getState().token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
}) as any;
