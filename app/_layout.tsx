import { useEffect, useRef } from "react";
import { View, ActivityIndicator, useColorScheme } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { TRPCProvider } from "@/providers/TRPCProvider";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { trpc } from "@/lib/trpc";
import { registerForPushNotificationsAsync, platformName } from "@/lib/pushNotifications";
import "../global.css";

function PushTokenRegistrar() {
  const token = useAuthStore((s) => s.token);
  const registerToken = trpc.pushTokens.register.useMutation();
  const lastRegistered = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      lastRegistered.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const expoToken = await registerForPushNotificationsAsync();
      if (cancelled || !expoToken || expoToken === lastRegistered.current) return;
      try {
        await registerToken.mutateAsync({ token: expoToken, platform: platformName() });
        lastRegistered.current = expoToken;
      } catch (err) {
        console.warn("[push] failed to register token with BE", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return null;
}

function NotificationTapHandler() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Any push tap → take the user to the notifications list.
      router.push("/notifications" as never);
    });
    return () => sub.remove();
  }, []);

  return null;
}

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
    <View
      className={`flex-1 ${scheme === "dark" ? "dark" : ""}`}
      style={{ backgroundColor: scheme === "dark" ? "#050816" : "#F8FAFC" }}
    >
      <PushTokenRegistrar />
      <NotificationTapHandler />
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
