import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  BatteryFull,
  Bluetooth,
  CheckCircle,
  HeartPulse,
  Search,
} from "lucide-react-native";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { haptic } from "@/lib/haptics";
import {
  connectToSensor,
  disconnectSensor,
  isSupported as bleSupported,
  scanForSensors,
  subscribeBle,
  type BleSensor,
  type BleStatus,
} from "@/lib/bleHeartRate";

/**
 * Pair a Bluetooth heart rate sensor.
 *
 * This is the brand-agnostic path: anything implementing the standard Heart
 * Rate Service shows up here, whether or not its vendor writes to Health
 * Connect. Chest straps and sports watches in broadcast mode qualify; most
 * lifestyle smartwatches don't advertise the service and won't appear.
 */

/** Scans are a real battery cost, so they stop on their own. */
const SCAN_TIMEOUT_MS = 20_000;

/** Rough signal buckets from RSSI in dBm. */
function signalBars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi >= -60) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

export default function PairSensorScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const [status, setStatus] = useState<BleStatus | null>(null);
  const [found, setFound] = useState<BleSensor[]>([]);
  const [scanning, setScanning] = useState(false);
  const stopScanRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => subscribeBle(setStatus), []);

  const stopScan = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    haptic.light();
    setFound([]);
    setScanning(true);

    const stop = await scanForSensors((sensor) => {
      setFound((prev) => {
        const existing = prev.findIndex((s) => s.id === sensor.id);
        // Re-advertisements carry a fresh RSSI; update in place rather than
        // letting the same strap pile up in the list.
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = sensor;
          return next;
        }
        return [...prev, sensor];
      });
    });

    stopScanRef.current = stop;
    timeoutRef.current = setTimeout(() => stopScan(), SCAN_TIMEOUT_MS);
  }, [stopScan]);

  // Always tear the scan down on unmount — leaving one running drains the
  // battery long after the athlete has left the screen.
  useEffect(() => stopScan, [stopScan]);

  const handleConnect = async (sensor: BleSensor) => {
    haptic.light();
    stopScan();
    const ok = await connectToSensor(sensor.id);
    if (ok) haptic.success();
  };

  const handleDisconnect = async () => {
    haptic.medium();
    await disconnectSensor();
  };

  const connected = status?.state === "connected";
  const supported = bleSupported();

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 60, paddingTop: insets.top + 12 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <Row className="items-center gap-3 px-5 mb-5">
        <PressableScale
          onPress={() => router.back()}
          hapticType="light"
          className="w-9 h-9 rounded-full bg-bg3 items-center justify-center"
        >
          <ArrowLeft size={18} color={isDark ? "#F8FAFC" : "#0F172A"} />
        </PressableScale>
        <Text className="text-txt font-bold text-lg flex-1 text-start">
          {t("sensor.title")}
        </Text>
      </Row>

      <View className="px-5">
        <Text className="text-txt3 text-xs mb-4 text-start leading-5">
          {t("sensor.intro")}
        </Text>

        {!supported && (
          <View className="bg-bg3 border border-bg5 rounded-2xl p-4 mb-4">
            <Text className="text-txt3 text-xs text-start">{t("sensor.unsupported")}</Text>
          </View>
        )}

        {status?.state === "unauthorized" && (
          <View className="bg-amber/10 border border-amber/30 rounded-2xl p-4 mb-4">
            <Text className="text-amber text-xs text-start">{t("sensor.permissionDenied")}</Text>
          </View>
        )}

        {status?.state === "bluetooth_off" && (
          <View className="bg-amber/10 border border-amber/30 rounded-2xl p-4 mb-4">
            <Text className="text-amber text-xs text-start">{t("sensor.bluetoothOff")}</Text>
          </View>
        )}

        {/* Connected sensor — live BPM doubles as proof the pairing works */}
        {connected && status?.device && (
          <View className="bg-bg2 border border-accent/30 rounded-3xl p-5 mb-4">
            <Row className="items-center gap-3 mb-3">
              <View className="w-11 h-11 rounded-2xl bg-accent/15 items-center justify-center">
                <CheckCircle size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-txt font-bold text-base text-start">
                  {status.device.name}
                </Text>
                <Text className="text-accent text-xs mt-0.5 text-start">
                  {t("sensor.connected")}
                </Text>
              </View>
              {status.batteryPercent !== null && (
                <Row className="items-center gap-1">
                  <BatteryFull size={13} color={isDark ? "#94A3B8" : "#64748B"} />
                  <Text className="text-txt3 text-[11px]">{status.batteryPercent}%</Text>
                </Row>
              )}
            </Row>

            <Row className="items-center gap-4 bg-bg3 rounded-2xl px-4 py-3 mb-3">
              <Row className="items-center gap-2 flex-1">
                <HeartPulse size={18} color="#EF4444" />
                <Text className="text-txt font-bold text-2xl tabular-nums">
                  {status.bpm ?? "—"}
                </Text>
                <Text className="text-txt3 text-[11px]">bpm</Text>
              </Row>
              {status.hrvMs !== null && (
                <View className="items-end">
                  <Text className="text-txt font-semibold text-sm tabular-nums">
                    {status.hrvMs}
                  </Text>
                  <Text className="text-txt3 text-[9px]">HRV ms</Text>
                </View>
              )}
            </Row>

            {status.contact === false && (
              <Text className="text-amber text-[11px] mb-3 text-start">
                {t("sensor.contactLost")}
              </Text>
            )}

            <PressableScale
              hapticType="medium"
              onPress={handleDisconnect}
              className="bg-coral/10 border border-coral/30 rounded-2xl py-3 items-center"
            >
              <Text className="text-coral font-semibold text-sm">{t("sensor.forget")}</Text>
            </PressableScale>
          </View>
        )}

        {status?.state === "reconnecting" && (
          <Row className="items-center gap-2 mb-4">
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text className="text-amber text-xs">{t("sensor.reconnecting")}</Text>
          </Row>
        )}

        {!connected && (
          <>
            <PressableScale
              hapticType="none"
              onPress={() => (scanning ? stopScan() : void startScan())}
              disabled={!supported}
              className="rounded-2xl py-3.5 items-center mb-4"
              style={{ backgroundColor: "#0EA5E9", opacity: supported ? 1 : 0.5 }}
            >
              <Row className="items-center gap-2">
                {scanning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Search size={16} color="#fff" />
                )}
                <Text style={{ color: "#fff" }} className="font-bold text-sm">
                  {scanning ? t("sensor.scanning") : t("sensor.scan")}
                </Text>
              </Row>
            </PressableScale>

            {found.length === 0 && scanning && (
              <Text className="text-txt3 text-xs text-center mb-4">{t("sensor.searchHint")}</Text>
            )}

            {found.length === 0 && !scanning && status?.state !== "unauthorized" && (
              <Text className="text-txt3 text-xs text-center mb-4">{t("sensor.noneFound")}</Text>
            )}

            {found.length > 0 && (
              <View className="bg-bg2 border border-bg5 rounded-2xl overflow-hidden">
                {found.map((sensor, i) => {
                  const bars = signalBars(sensor.rssi);
                  const isConnecting =
                    status?.state === "connecting" && status.device?.id === sensor.id;
                  return (
                    <PressableScale
                      key={sensor.id}
                      hapticType="none"
                      onPress={() => void handleConnect(sensor)}
                      className={i < found.length - 1 ? "border-b border-bg5" : ""}
                    >
                      <Row className="items-center gap-3 px-4 py-3.5">
                        <Bluetooth size={16} color="#0EA5E9" />
                        <View className="flex-1">
                          <Text className="text-txt text-sm font-semibold text-start" numberOfLines={1}>
                            {sensor.name}
                          </Text>
                          <Text className="text-txt3 text-[10px] text-start">
                            {t("sensor.signal", { bars: "▮".repeat(bars) + "▯".repeat(3 - bars) })}
                          </Text>
                        </View>
                        {isConnecting ? (
                          <ActivityIndicator size="small" color="#0EA5E9" />
                        ) : (
                          <Text className="text-primary text-xs font-semibold">
                            {t("sensor.connect")}
                          </Text>
                        )}
                      </Row>
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </>
        )}

        <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mt-4">
          <Text className="text-primary text-[11px] leading-5 text-center">
            {t("sensor.broadcastHint")}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
