import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Platform, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle, CircleSlash, MinusCircle, RefreshCw } from "lucide-react-native";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { haptic } from "@/lib/haptics";
import { metricMeta } from "@/lib/metricCatalog";
import {
  currentProvider,
  detectSourceApps,
  getAvailability,
  isSupported as watchSupported,
  probeRecordTypes,
  type Availability,
  type RecordTypeProbe,
} from "@/lib/vitalsSource";

/**
 * Watch diagnostics.
 *
 * Answers the question you can't otherwise answer without a debugger: for this
 * specific watch on this specific phone, which record types are approved, and
 * which of those are actually producing data?
 *
 * Those are different failure modes and they need different fixes — a denied
 * type is a permissions problem the athlete can solve, whereas a granted-but-
 * empty type means the watch or its companion app simply doesn't write it, and
 * no amount of tapping will change that. Lumping them together is what makes
 * "why can't my coach see my SpO₂" unanswerable.
 */

const LOOKBACK_DAYS = 7;

type Status = "producing" | "granted_empty" | "denied";

function statusOf(probe: RecordTypeProbe): Status {
  if (probe.sampleCount > 0) return "producing";
  return probe.granted ? "granted_empty" : "denied";
}

const STATUS_ORDER: Record<Status, number> = { producing: 0, granted_empty: 1, denied: 2 };

export default function WatchDiagnosticsScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [probes, setProbes] = useState<RecordTypeProbe[] | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [sourceApps, setSourceApps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const [a, apps, results] = await Promise.all([
        getAvailability(),
        detectSourceApps(LOOKBACK_DAYS),
        probeRecordTypes(LOOKBACK_DAYS),
      ]);
      setAvailability(a);
      setSourceApps(apps);
      setProbes(results);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const sorted = [...(probes ?? [])].sort(
    (a, b) =>
      STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)] ||
      a.recordType.localeCompare(b.recordType),
  );

  const producing = sorted.filter((p) => statusOf(p) === "producing").length;
  const grantedEmpty = sorted.filter((p) => statusOf(p) === "granted_empty").length;
  const denied = sorted.filter((p) => statusOf(p) === "denied").length;

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
          {t("diagnostics.title")}
        </Text>
        <PressableScale
          onPress={() => {
            haptic.light();
            void run();
          }}
          hapticType="none"
          disabled={running}
          className="w-9 h-9 rounded-full bg-bg3 items-center justify-center"
        >
          <RefreshCw size={16} color={isDark ? "#94A3B8" : "#64748B"} />
        </PressableScale>
      </Row>

      <View className="px-5">
        {/* Device context — the things that change what's possible at all */}
        <View className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-4 gap-2">
          <DiagRow label={t("diagnostics.platform")} value={`${Platform.OS} ${String(Platform.Version)}`} />
          <DiagRow label={t("diagnostics.provider")} value={currentProvider()} />
          <DiagRow
            label={t("diagnostics.availability")}
            value={availability ? t(`vitals.availability.${availability}`) : "—"}
          />
          <DiagRow
            label={t("diagnostics.sourceApps")}
            value={sourceApps.length > 0 ? sourceApps.join(", ") : t("diagnostics.none")}
          />
          <DiagRow label={t("diagnostics.window")} value={t("diagnostics.lastDays", { days: LOOKBACK_DAYS })} />
        </View>

        {!watchSupported() && (
          <View className="bg-bg3 border border-bg5 rounded-2xl p-4 mb-4">
            <Text className="text-txt3 text-xs text-start">{t("diagnostics.unsupported")}</Text>
          </View>
        )}

        {running && probes === null ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#3B82F6" />
            <Text className="text-txt3 text-xs mt-3">{t("diagnostics.probing")}</Text>
          </View>
        ) : (
          <>
            {/* Counts first — usually the whole answer */}
            <Row className="gap-2 mb-4">
              <Tally count={producing} label={t("diagnostics.producing")} color="text-accent" />
              <Tally count={grantedEmpty} label={t("diagnostics.grantedEmpty")} color="text-amber" />
              <Tally count={denied} label={t("diagnostics.denied")} color="text-txt3" />
            </Row>

            {Platform.OS === "ios" && (
              <Text className="text-txt3 text-[11px] mb-4 text-start leading-4">
                {t("diagnostics.iosCaveat")}
              </Text>
            )}

            <View className="bg-bg2 border border-bg5 rounded-2xl overflow-hidden">
              {sorted.map((probe, i) => (
                <ProbeRow
                  key={probe.recordType}
                  probe={probe}
                  isLast={i === sorted.length - 1}
                  isDark={isDark}
                  t={t}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <Row className="items-center justify-between gap-3">
      <Text className="text-txt3 text-[11px] flex-shrink-0">{label}</Text>
      <Text className="text-txt font-semibold text-[11px] flex-1 text-end" numberOfLines={2}>
        {value}
      </Text>
    </Row>
  );
}

function Tally({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View className="flex-1 bg-bg2 border border-bg5 rounded-2xl px-3 py-2.5 items-center">
      <Text className={`font-bold text-xl ${color}`}>{count}</Text>
      <Text className="text-txt3 text-[10px] text-center mt-0.5">{label}</Text>
    </View>
  );
}

function ProbeRow({
  probe,
  isLast,
  isDark,
  t,
}: {
  probe: RecordTypeProbe;
  isLast: boolean;
  isDark: boolean;
  t: ReturnType<typeof useT>;
}) {
  const status = statusOf(probe);

  const icon =
    status === "producing" ? (
      <CheckCircle size={14} color="#10B981" />
    ) : status === "granted_empty" ? (
      <MinusCircle size={14} color="#F59E0B" />
    ) : (
      <CircleSlash size={14} color={isDark ? "#475569" : "#94A3B8"} />
    );

  return (
    <View className={`px-4 py-3 ${isLast ? "" : "border-b border-bg5"}`}>
      <Row className="items-center gap-2.5">
        {icon}
        <Text className="text-txt text-xs font-semibold flex-1 text-start" numberOfLines={1}>
          {probe.recordType}
        </Text>
        {probe.sampleCount > 0 && (
          <Text className="text-txt3 text-[10px] tabular-nums">
            {t("diagnostics.samples", { count: probe.sampleCount })}
          </Text>
        )}
      </Row>

      {/* Which of our metric keys this type actually yielded */}
      {probe.metrics.length > 0 && (
        <Text className="text-txt3 text-[10px] mt-1 ms-6 text-start">
          {probe.metrics.map((m) => metricMeta(m).label).join(" · ")}
        </Text>
      )}

      {probe.latestAt && (
        <Text className="text-txt3 text-[10px] mt-0.5 ms-6 text-start">
          {t("diagnostics.latest", { at: new Date(probe.latestAt).toLocaleString() })}
        </Text>
      )}

      {status === "granted_empty" && (
        <Text className="text-amber text-[10px] mt-1 ms-6 text-start">
          {t("diagnostics.grantedEmptyHint")}
        </Text>
      )}
    </View>
  );
}
