// Maps the workspace-style `@bat/api` import onto the local shim router type.
// See lib/api-types.ts for why this stand-in exists. Real per-procedure
// inference is lost; runtime calls still work via @trpc/client.
declare module "@bat/api" {
  export type { AppRouter } from "@/lib/api-types";
}
