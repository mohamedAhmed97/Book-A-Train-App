import { View, Text, Alert, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { gradients } from "@/lib/gradients";
import { haptic } from "@/lib/haptics";

function StravaLogo({ size = 40 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: "#FC4C02",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.52, letterSpacing: -0.5 }}>S</Text>
    </View>
  );
}

export default function IntegrationsScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const { data: status } = trpc.integrations.status.useQuery();
  const { data: authData } = trpc.integrations.getStravaAuthUrl.useQuery(undefined, {
    retry: false,
  });

  const disconnectMut = trpc.integrations.disconnectStrava.useMutation({
    onSuccess: () => {
      haptic.medium();
      utils.integrations.status.invalidate();
    },
    onError: (e: any) => Alert.alert(t("integrations.disconnectError"), e.message),
  });

  const handleConnect = async () => {
    if (!authData?.url) return;
    haptic.light();
    const result = await WebBrowser.openAuthSessionAsync(
      authData.url,
      "bat-athlete://strava-callback",
    );
    if (result.type === "success") {
      const url = new URL(result.url);
      if (url.searchParams.get("success") === "1") {
        haptic.success();
        utils.integrations.status.invalidate();
      } else {
        Alert.alert(t("integrations.connectError"), url.searchParams.get("error") ?? "");
      }
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      t("integrations.disconnectConfirm"),
      t("integrations.disconnectConfirmMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("integrations.disconnect"),
          style: "destructive",
          onPress: () => {
            haptic.medium();
            disconnectMut.mutate();
          },
        },
      ],
    );
  };

  const isConnected = status?.strava?.connected ?? false;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ height: 150 + insets.top }}>
        <LinearGradient
          colors={gradients.sunset as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          className="absolute w-64 h-64 rounded-full"
          style={{ top: -80, end: -60, backgroundColor: "rgba(255,255,255,0.15)" }}
        />

        <View style={{ position: "absolute", top: insets.top + 14, left: 20, zIndex: 10 }}>
          <PressableScale
            onPress={() => router.back()}
            hapticType="light"
            className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </PressableScale>
        </View>

        <View className="items-center" style={{ paddingTop: insets.top + 56 }}>
          <Text className="text-white font-bold text-xl">{t("integrations.title")}</Text>
          <Text className="text-white/70 text-sm mt-1">{t("integrations.subtitle")}</Text>
        </View>
      </View>

      <View className="px-5 -mt-4">
        <Animated.View entering={FadeInUp.duration(400)}>
          <View className="bg-bg2 border border-bg5 rounded-3xl overflow-hidden" style={{ elevation: 4 }}>
            {/* Strava row */}
            <View className="p-5">
              <Row className="items-center gap-3 mb-4">
                <StravaLogo size={44} />
                <View className="flex-1">
                  <Row className="items-center gap-2">
                    <Text className="text-txt font-bold text-base text-start">
                      {t("integrations.stravaName")}
                    </Text>
                    {isConnected && (
                      <View className="flex-row items-center gap-1 bg-accent/15 rounded-full px-2 py-0.5">
                        <CheckCircle size={11} color="#10B981" />
                        <Text className="text-accent text-[11px] font-semibold">
                          {t("integrations.connected")}
                        </Text>
                      </View>
                    )}
                  </Row>
                  <Text className="text-txt3 text-xs mt-0.5 text-start" numberOfLines={2}>
                    {t("integrations.stravaDesc")}
                  </Text>
                </View>
              </Row>

              {isConnected ? (
                <PressableScale
                  hapticType="medium"
                  onPress={handleDisconnect}
                  disabled={disconnectMut.isPending}
                  className="bg-coral/10 border border-coral/30 rounded-2xl py-3.5 items-center"
                >
                  <Text className="text-coral font-semibold text-sm">
                    {disconnectMut.isPending
                      ? t("integrations.disconnecting")
                      : t("integrations.disconnect")}
                  </Text>
                </PressableScale>
              ) : (
                <PressableScale
                  hapticType="light"
                  onPress={handleConnect}
                  disabled={!authData?.url}
                  className="rounded-2xl py-3.5 items-center"
                  style={{ backgroundColor: "#FC4C02", opacity: !authData?.url ? 0.5 : 1 }}
                >
                  <Text style={{ color: "#fff" }} className="font-bold text-sm">
                    {t("integrations.connectStrava")}
                  </Text>
                </PressableScale>
              )}
            </View>
          </View>
        </Animated.View>

        {isConnected && (
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <View className="bg-accent/10 border border-accent/20 rounded-2xl p-4 mt-4">
              <Text className="text-accent text-xs font-semibold text-center leading-relaxed">
                {t("integrations.syncHint")}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}
