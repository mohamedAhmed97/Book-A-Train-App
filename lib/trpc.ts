import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@bat/api";

export const trpc = createTRPCReact<AppRouter>();
