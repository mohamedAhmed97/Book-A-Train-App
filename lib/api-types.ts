/**
 * Minimal stand-in AppRouter type for the mobile app.
 *
 * The real router lives in Book-A-Train-BE. This shim creates an empty tRPC
 * router so that:
 *   1. `import type { AppRouter } from "@bat/api"` (via the bat-api.d.ts
 *      ambient module) resolves to a STRUCTURALLY valid Router type,
 *   2. tRPC's `createTRPCReact<AppRouter>` accepts it without emitting
 *      "property collides with a built-in method" errors,
 *   3. typed inference is naturally lost (the procedures map is empty), so
 *      `trpc.<router>.<procedure>` access falls back to dynamic typing.
 *
 * Restore real type inference by setting up a shared @bat/types package.
 */
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();
export const appRouter = t.router({});
export type AppRouter = typeof appRouter;
