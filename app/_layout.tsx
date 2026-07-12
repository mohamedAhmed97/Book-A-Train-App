import { useEffect } from "react";
import { View, ActivityIndicator, useColorScheme } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TRPCProvider } from "@/providers/TRPCProvider";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import "../global.css";
// Registers the background GPS task before any navigation renders
import "@/lib/workoutTracker";

function AuthGate() {
  const { token, isLoading, loadFromStorage } = useAuthStore();
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const isLocaleHydrated = useLocaleStore((s) => s.isHydrated);
  const segments = useSegments();
  const router = useRouter();
  const scheme = useColorScheme();

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
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  return (
    <View className={`flex-1 ${scheme === "dark" ? "dark" : ""}`} style={{ backgroundColor: scheme === "dark" ? "#050816" : "#F8FAFC" }}>
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TRPCProvider>
        <AuthGate />
      </TRPCProvider>
    </SafeAreaProvider>
  );
}
