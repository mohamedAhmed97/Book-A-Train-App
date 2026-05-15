import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { TRPCProvider } from "@/providers/TRPCProvider";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import "../global.css";

function AuthGate() {
  const { token, isLoading, loadFromStorage } = useAuthStore();
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const isLocaleHydrated = useLocaleStore((s) => s.isHydrated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrateLocale();
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (isLoading || !isLocaleHydrated) return;
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) router.replace("/(auth)");
    if (token && inAuth) router.replace("/(tabs)");
  }, [token, isLoading, isLocaleHydrated, segments]);

  if (!isLocaleHydrated) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#42A5F5" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <TRPCProvider>
      <AuthGate />
    </TRPCProvider>
  );
}
