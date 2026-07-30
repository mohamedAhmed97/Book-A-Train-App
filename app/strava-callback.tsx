import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { haptic } from "@/lib/haptics";

export default function StravaCallbackScreen() {
  const router = useRouter();
  const { success, error } = useLocalSearchParams<{ success?: string; error?: string }>();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (success === "1") {
      haptic.success();
      utils.integrations.status.invalidate();
    }
    // Navigate to integrations regardless of success/error
    const timer = setTimeout(() => {
      router.replace("/integrations" as never);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const failed = !!error;

  return (
    <View className="flex-1 bg-bg items-center justify-center gap-4">
      {failed ? (
        <>
          <Text className="text-2xl">❌</Text>
          <Text className="text-txt font-semibold text-base">Strava connection failed</Text>
          <Text className="text-txt3 text-sm">Redirecting back…</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#FC4C02" />
          <Text className="text-txt font-semibold text-base">
            {success === "1" ? "Strava connected! 🎉" : "Connecting Strava…"}
          </Text>
          <Text className="text-txt3 text-sm">Please wait</Text>
        </>
      )}
    </View>
  );
}
