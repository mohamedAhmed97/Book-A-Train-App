import { useCallback, useEffect, useState } from "react";
import { View, Text, Alert, ScrollView, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bluetooth, CheckCircle, Watch, HeartPulse } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { gradients } from "@/lib/gradients";
import { haptic } from "@/lib/haptics";
import {
  currentProvider,
  detectSourceApps,
  getAvailability,
  getGrantedRecordTypes,
  isSupported as watchSupported,
  openSettings as openHealthSettings,
  requestPermissions,
  type Availability,
} from "@/lib/vitalsSource";
import { syncDailyVitals } from "@/lib/vitalsStreamer";
import { subscribeBle, type BleStatus } from "@/lib/bleHeartRate";

const HEALTH_CONNECT_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

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

function WatchLogo({ size = 44 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: "#0EA5E9",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Watch size={size * 0.55} color="#FFFFFF" />
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

  // ── Watch vitals (Health Connect on Android, HealthKit on iOS) ──────────
  const { data: watchStatus } = trpc.vitals.status.useQuery();
  const [bleStatus, setBleStatus] = useState<BleStatus | null>(null);
  useEffect(() => subscribeBle(setBleStatus), []);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [sourceApps, setSourceApps] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);

  const watchIsConnected = watchStatus?.connected ?? false;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await getAvailability();
      if (!cancelled) setAvailability(a);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Which vendor app/device is feeding the health store is only knowable once
  // we have read permission, so this runs after the athlete connects.
  useEffect(() => {
    if (!watchIsConnected) return;
    let cancelled = false;
    void (async () => {
      const apps = await detectSourceApps();
      if (!cancelled) setSourceApps(apps);
    })();
    return () => {
      cancelled = true;
    };
  }, [watchIsConnected]);

  const connectWatchMut = trpc.vitals.connect.useMutation({
    onSuccess: () => {
      haptic.success();
      utils.vitals.status.invalidate();
    },
    onError: (e: any) => Alert.alert(t("integrations.watchConnectError"), e.message),
  });

  const disconnectWatchMut = trpc.vitals.disconnect.useMutation({
    onSuccess: () => {
      haptic.medium();
      utils.vitals.status.invalidate();
    },
    onError: (e: any) => Alert.alert(t("integrations.watchDisconnectError"), e.message),
  });

  const handleConnectWatch = useCallback(async () => {
    haptic.light();

    if (!watchSupported()) {
      Alert.alert(t("integrations.watchUnsupportedTitle"), t("integrations.watchUnsupportedMsg"));
      return;
    }
    // Android 8 can't run Health Connect at all — say so instead of offering an
    // install the Play Store will refuse.
    if (availability === "unsupported_os") {
      Alert.alert(
        t("integrations.watchUnsupportedOsTitle"),
        t("integrations.watchUnsupportedOsMsg"),
      );
      return;
    }
    if (availability === "not_installed" || availability === "update_required") {
      Alert.alert(
        t("integrations.watchInstallTitle"),
        t("integrations.watchInstallMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("integrations.watchInstallAction"), onPress: () => Linking.openURL(HEALTH_CONNECT_PLAY_URL) },
        ],
      );
      return;
    }

    setLinking(true);
    try {
      // Health Connect reports exactly which types were approved. HealthKit
      // deliberately won't (it would leak health info), so its reader probes by
      // reading — either way, record what came back, not what we asked for.
      let granted = await requestPermissions();
      if (granted.length === 0) granted = await getGrantedRecordTypes();

      if (granted.length === 0) {
        Alert.alert(
          t("integrations.watchDeniedTitle"),
          t("integrations.watchDeniedMsg"),
          [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("integrations.watchOpenSettings"), onPress: () => void openHealthSettings() },
          ],
        );
        return;
      }

      const apps = await detectSourceApps();
      setSourceApps(apps);

      await connectWatchMut.mutateAsync({
        provider: currentProvider(),
        grantedTypes: granted,
        deviceName: apps[0],
      });

      // Seed today's recovery numbers so the screen isn't empty on first connect.
      void syncDailyVitals();
    } finally {
      setLinking(false);
    }
  }, [availability, connectWatchMut, t]);

  const handleDisconnectWatch = () => {
    Alert.alert(t("integrations.watchDisconnectConfirm"), t("integrations.watchDisconnectConfirmMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("integrations.disconnect"),
        style: "destructive",
        onPress: () => {
          haptic.medium();
          disconnectWatchMut.mutate();
        },
      },
    ]);
  };

  const watchSubtitle = () => {
    if (!watchSupported()) return t("integrations.watchUnavailable");
    if (availability === "unsupported_os") return t("integrations.watchUnsupportedOs");
    if (availability === "not_installed") return t("integrations.watchNotInstalled");
    if (availability === "update_required") return t("integrations.watchUpdateRequired");
    if (watchIsConnected && sourceApps.length > 0)
      return t("integrations.watchReadingFrom", { apps: sourceApps.join(", ") });
    return t("integrations.watchDesc");
  };

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

        {/* Android watch — reads vitals via Health Connect */}
        <Animated.View entering={FadeInUp.delay(150).duration(400)} className="mt-4">
          <View className="bg-bg2 border border-bg5 rounded-3xl overflow-hidden" style={{ elevation: 4 }}>
            <View className="p-5">
              <Row className="items-center gap-3 mb-4">
                <WatchLogo size={44} />
                <View className="flex-1">
                  <Row className="items-center gap-2">
                    <Text className="text-txt font-bold text-base text-start">
                      {t("integrations.watchName")}
                    </Text>
                    {watchIsConnected && (
                      <View className="flex-row items-center gap-1 bg-accent/15 rounded-full px-2 py-0.5">
                        <CheckCircle size={11} color="#10B981" />
                        <Text className="text-accent text-[11px] font-semibold">
                          {t("integrations.connected")}
                        </Text>
                      </View>
                    )}
                  </Row>
                  <Text className="text-txt3 text-xs mt-0.5 text-start" numberOfLines={2}>
                    {watchSubtitle()}
                  </Text>
                </View>
              </Row>

              {watchIsConnected && (
                <View className="bg-bg3 rounded-2xl px-4 py-3 mb-3 gap-1.5">
                  <Row className="items-center justify-between">
                    <Text className="text-txt3 text-[11px]">{t("integrations.watchMetricsGranted")}</Text>
                    <Text className="text-txt font-semibold text-[11px]">
                      {watchStatus?.grantedTypes?.length ?? 0}
                    </Text>
                  </Row>
                  <Row className="items-center justify-between">
                    <Text className="text-txt3 text-[11px]">{t("integrations.watchLastSync")}</Text>
                    <Text className="text-txt font-semibold text-[11px]">
                      {watchStatus?.lastSyncAt
                        ? new Date(watchStatus.lastSyncAt).toLocaleString()
                        : t("integrations.watchNeverSynced")}
                    </Text>
                  </Row>
                  <Row className="items-center justify-between">
                    <Row className="items-center gap-1.5">
                      <HeartPulse size={12} color="#EF4444" />
                      <Text className="text-txt3 text-[11px]">{t("integrations.watchMaxHr")}</Text>
                    </Row>
                    <Text className="text-txt font-semibold text-[11px]">
                      {watchStatus?.maxHeartRate ?? 190} bpm
                      {watchStatus?.maxHeartRateIsDefault ? ` (${t("integrations.watchEstimated")})` : ""}
                    </Text>
                  </Row>
                </View>
              )}

              {watchIsConnected ? (
                <>
                  <PressableScale
                    hapticType="light"
                    onPress={() => void openHealthSettings()}
                    className="bg-bg3 border border-bg5 rounded-2xl py-3 items-center mb-2"
                  >
                    <Text className="text-txt2 font-semibold text-sm">
                      {t("integrations.watchManagePermissions")}
                    </Text>
                  </PressableScale>
                  {/* Which types are approved vs actually producing data */}
                  <PressableScale
                    hapticType="light"
                    onPress={() => router.push("/watch-diagnostics" as never)}
                    className="bg-bg3 border border-bg5 rounded-2xl py-3 items-center mb-2"
                  >
                    <Text className="text-txt2 font-semibold text-sm">
                      {t("integrations.watchDiagnostics")}
                    </Text>
                  </PressableScale>
                  <PressableScale
                    hapticType="medium"
                    onPress={handleDisconnectWatch}
                    disabled={disconnectWatchMut.isPending}
                    className="bg-coral/10 border border-coral/30 rounded-2xl py-3.5 items-center"
                  >
                    <Text className="text-coral font-semibold text-sm">
                      {disconnectWatchMut.isPending
                        ? t("integrations.disconnecting")
                        : t("integrations.disconnect")}
                    </Text>
                  </PressableScale>
                </>
              ) : (
                <PressableScale
                  hapticType="light"
                  onPress={handleConnectWatch}
                  disabled={linking || connectWatchMut.isPending || !watchSupported()}
                  className="rounded-2xl py-3.5 items-center"
                  style={{
                    backgroundColor: "#0EA5E9",
                    opacity: linking || connectWatchMut.isPending || !watchSupported() ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#fff" }} className="font-bold text-sm">
                    {linking || connectWatchMut.isPending
                      ? t("integrations.watchConnecting")
                      : t("integrations.watchConnect")}
                  </Text>
                </PressableScale>
              )}
            </View>
          </View>
        </Animated.View>

        {/*
          Bluetooth heart rate sensor — a separate channel, not a fallback.
          Health Connect delivers on the vendor's sync schedule; a strap streams
          live. An athlete can sensibly use both at once.
        */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="mt-4">
          <View className="bg-bg2 border border-bg5 rounded-3xl p-5" style={{ elevation: 4 }}>
            <Row className="items-center gap-3 mb-4">
              <View className="w-11 h-11 rounded-2xl bg-sky-500/15 items-center justify-center">
                <Bluetooth size={20} color="#0EA5E9" />
              </View>
              <View className="flex-1">
                <Row className="items-center gap-2">
                  <Text className="text-txt font-bold text-base text-start">
                    {t("integrations.sensorName")}
                  </Text>
                  {bleStatus?.state === "connected" && (
                    <View className="flex-row items-center gap-1 bg-accent/15 rounded-full px-2 py-0.5">
                      <CheckCircle size={11} color="#10B981" />
                      <Text className="text-accent text-[11px] font-semibold">
                        {t("integrations.connected")}
                      </Text>
                    </View>
                  )}
                </Row>
                <Text className="text-txt3 text-xs mt-0.5 text-start" numberOfLines={2}>
                  {bleStatus?.state === "connected" && bleStatus.device
                    ? t("integrations.sensorConnectedTo", { name: bleStatus.device.name })
                    : t("integrations.sensorDesc")}
                </Text>
              </View>
            </Row>

            <PressableScale
              hapticType="light"
              onPress={() => router.push("/pair-sensor" as never)}
              className="rounded-2xl py-3.5 items-center"
              style={{ backgroundColor: bleStatus?.state === "connected" ? undefined : "#0EA5E9" }}
            >
              <Text
                className={
                  bleStatus?.state === "connected"
                    ? "text-txt2 font-semibold text-sm"
                    : "font-bold text-sm"
                }
                style={bleStatus?.state === "connected" ? undefined : { color: "#fff" }}
              >
                {bleStatus?.state === "connected"
                  ? t("integrations.sensorManage")
                  : t("integrations.sensorPair")}
              </Text>
            </PressableScale>
          </View>
        </Animated.View>

        {watchIsConnected && (
          <Animated.View entering={FadeInUp.delay(250).duration(400)}>
            <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mt-4">
              <Text className="text-primary text-xs font-semibold text-center leading-relaxed">
                {t("integrations.watchSyncHint")}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}
