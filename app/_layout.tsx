import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { TRPCProvider } from "@/providers/TRPCProvider";
import { useAuthStore } from "@/stores/auth";
import "../global.css";

function AuthGate() {
  const { user, token, isLoading, loadFromStorage } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) router.replace("/(auth)");
    if (token && inAuth) router.replace("/(tabs)");
  }, [token, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <TRPCProvider>
      <AuthGate />
    </TRPCProvider>
  );
}
