import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@bat/api";

// The shared @bat/api workspace package isn't actually published, so AppRouter
// resolves to a stub router with no procedures (see lib/api-types.ts). To keep
// every screen's tRPC call (`trpc.sessions.today.useQuery()` etc.) compiling
// without a typed router available, we cast the client to `any`.
//
// Runtime behavior is unaffected — tRPC over HTTP doesn't need compile-time
// types. To restore typed inference, expose the real BE AppRouter as a shared
// package and remove this cast.
export const trpc = createTRPCReact<AppRouter>() as any;
