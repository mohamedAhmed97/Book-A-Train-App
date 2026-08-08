import { View, Text } from "react-native";
import { Activity, HeartPulse, Wind, Droplets, WifiOff } from "lucide-react-native";
import { useVitalsStore, zoneFor, ZONE_COLORS } from "@/stores/vitalsStore";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";

/**
 * Compact live readout of the athlete's watch during a recording session.
 * Renders nothing when no watch is streaming, so the training screen keeps its
 * existing layout for athletes without one.
 */
export function LiveVitalsBar() {
  const t = useT();
  const { state, message, latest, maxHeartRate, pendingCount } = useVitalsStore();

  if (state === "idle") return null;

  const hr = latest.HEART_RATE;
  const spo2 = latest.SPO2;
  const rr = latest.RESPIRATORY_RATE;
  const zone = hr ? zoneFor(hr.value, maxHeartRate) : null;
  const zoneColor = zone ? ZONE_COLORS[zone] : "#64748B";

  // Checked before the waiting state: an error with no reading yet should say
  // what went wrong, not sit on "waiting for your watch".
  if (state === "error" && !hr) {
    return (
      <View className="bg-bg3 border border-bg5 rounded-2xl px-4 py-3 mb-4">
        <Row className="items-center gap-2.5">
          <WifiOff size={14} color="#F59E0B" />
          <Text className="text-txt3 text-xs flex-1 text-start">
            {t(`vitals.error.${message ?? "read_failed"}`)}
          </Text>
        </Row>
      </View>
    );
  }

  // Connected but the vendor app hasn't flushed anything to Health Connect yet.
  if (state === "starting" || state === "no_data" || !hr) {
    return (
      <View className="bg-bg3 border border-bg5 rounded-2xl px-4 py-3 mb-4">
        <Row className="items-center gap-2.5">
          <Activity size={14} color="#64748B" />
          <Text className="text-txt3 text-xs flex-1 text-start">
            {state === "starting" ? t("vitals.connecting") : t("vitals.waitingForWatch")}
          </Text>
        </Row>
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl px-4 py-3 mb-4 border"
      style={{ backgroundColor: `${zoneColor}14`, borderColor: `${zoneColor}44` }}
    >
      <Row className="items-center gap-3">
        <HeartPulse size={18} color={zoneColor} />
        <View>
          <Row className="items-baseline gap-1">
            <Text className="font-bold text-2xl" style={{ color: zoneColor }}>
              {Math.round(hr.value)}
            </Text>
            <Text className="text-txt3 text-[11px] font-semibold">bpm</Text>
          </Row>
          <Text className="text-txt3 text-[10px] tracking-wide">
            {t("vitals.zoneLabel", { zone: zone ?? 1 })}
          </Text>
        </View>

        <View className="flex-1" />

        {spo2 && (
          <View className="items-center">
            <Row className="items-center gap-1">
              <Droplets size={12} color="#38BDF8" />
              <Text className="text-txt font-bold text-sm">{Math.round(spo2.value)}%</Text>
            </Row>
            <Text className="text-txt3 text-[9px] tracking-wide">SpO₂</Text>
          </View>
        )}

        {rr && (
          <View className="items-center">
            <Row className="items-center gap-1">
              <Wind size={12} color="#A78BFA" />
              <Text className="text-txt font-bold text-sm">{Math.round(rr.value)}</Text>
            </Row>
            <Text className="text-txt3 text-[9px] tracking-wide">{t("vitals.rrShort")}</Text>
          </View>
        )}
      </Row>

      {/* Surfaced so the athlete knows readings are buffered, not lost. */}
      {state === "error" && pendingCount > 0 && (
        <Text className="text-txt3 text-[10px] mt-2 text-start">
          {t("vitals.queued", { count: pendingCount })}
        </Text>
      )}
    </View>
  );
}
