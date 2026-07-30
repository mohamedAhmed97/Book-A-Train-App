import { useState } from "react";
import { ScrollView, View, Text, RefreshControl, ActivityIndicator, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ClipboardList, CheckCircle2, Clock, Layers } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useT, useLocale } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };

const SPORT_EMOJI: Record<string, string> = {
  Cycling: "🚴", Running: "🏃", Swimming: "🏊", CrossFit: "🏋️",
  Football: "⚽", Basketball: "🏀", Tennis: "🎾", General: "🏅",
};

type Tab = "pending" | "completed";

export default function TestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  const utils = trpc.useUtils();
  const { data: tests, isLoading: loadingTests } = trpc.tests.myTests.useQuery();
  const { data: customAssignments, isLoading: loadingCustom } = trpc.customTests.myAssignments.useQuery();
  const isLoading = loadingTests || loadingCustom;

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      utils.tests.myTests.invalidate(),
      utils.customTests.myAssignments.invalidate(),
    ]),
  );

  const standard = (tests ?? []).map((item) => ({ ...item, _kind: "standard" as const }));
  const custom = (customAssignments ?? []).map((item) => ({ ...item, _kind: "custom" as const }));
  const all = [...standard, ...custom];

  const pending = all.filter((item) => item.status === "PENDING");
  const completed = all.filter((item) => item.status === "COMPLETED");
  const shown = activeTab === "pending" ? pending : completed;
  const isEmpty = all.length === 0;

  return (
    <View className="flex-1 bg-bg">
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Row className="items-center gap-3 mb-4">
          <PressableScale
            onPress={() => router.back()}
            hapticType="light"
            className="w-9 h-9 items-center justify-center rounded-full bg-bg3"
          >
            <ChevronLeft size={18} color={scheme === "dark" ? "#CBD5E1" : "#475569"} />
          </PressableScale>
          <Text className="text-txt font-bold text-xl">{t("tests.title")}</Text>
        </Row>

        <Row className="bg-bg3 rounded-2xl p-1 gap-1">
          {(["pending", "completed"] as Tab[]).map((tab) => (
            <PressableScale
              key={tab}
              onPress={() => setActiveTab(tab)}
              hapticType="selection"
              className={`flex-1 rounded-xl py-2 items-center ${activeTab === tab ? "bg-primary" : ""}`}
            >
              <Text className={`text-xs font-bold ${activeTab === tab ? "text-white" : "text-txt2"}`}>
                {t(`tests.${tab}`)}
                {tab === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}
                {tab === "completed" && completed.length > 0 ? ` (${completed.length})` : ""}
              </Text>
            </PressableScale>
          ))}
        </Row>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
          showsVerticalScrollIndicator={false}
        >
          {shown.length === 0 ? (
            <View className="items-center justify-center mt-20 gap-3">
              <View className="w-20 h-20 rounded-full bg-bg3 items-center justify-center">
                <ClipboardList size={36} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
              </View>
              <Text className="text-txt font-bold text-lg">
                {isEmpty
                  ? t("tests.noTests")
                  : activeTab === "pending"
                    ? t("tests.noPending")
                    : t("tests.noCompleted")}
              </Text>
              {isEmpty && (
                <Text className="text-txt3 text-sm text-center">{t("tests.noTestsHint")}</Text>
              )}
            </View>
          ) : (
            shown.map((item: any, idx: number) => (
              <Animated.View key={`${item._kind}-${item.id}`} entering={FadeInUp.delay(idx * 50).duration(350)}>
                {item._kind === "standard" ? (
                  <TestCard item={item} tag={tag} t={t} />
                ) : (
                  <CustomTestCard item={item} tag={tag} t={t} />
                )}
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function TestCard({ item, tag, t }: { item: any; tag: string; t: (k: string, v?: any) => string }) {
  const scheme = useColorScheme();
  const isDone = item.status === "COMPLETED";
  const emoji = SPORT_EMOJI[item.test.sport ?? "General"] ?? "🏅";

  return (
    <View className={`rounded-3xl border p-5 ${isDone ? "bg-accent/6 border-accent-light/25" : "bg-bg2 border-bg5"}`}>
      <Row className="items-start gap-3">
        <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isDone ? "bg-accent/15" : "bg-primary/12"}`}>
          <Text className="text-2xl">{emoji}</Text>
        </View>

        <View className="flex-1">
          <Row className="items-center gap-2 mb-0.5">
            <Text className="text-txt font-bold text-base flex-1" numberOfLines={1}>
              {item.test.name}
            </Text>
            <StatusBadge done={isDone} t={t} />
          </Row>

          <Text className="text-txt3 text-xs mb-1">
            {t("tests.assignedBy", { name: item.coach.user.name })}
          </Text>

          {item.test.description && (
            <Text className="text-txt2 text-xs leading-relaxed mb-2" numberOfLines={2}>
              {item.test.description}
            </Text>
          )}

          {item.scheduledAt && !isDone && (
            <Row className="items-center gap-1 mb-2">
              <Clock size={11} color={scheme === "dark" ? "#64748B" : "#94A3B8"} />
              <Text className="text-txt3 text-xs">
                {t("tests.scheduledFor", {
                  date: new Date(item.scheduledAt).toLocaleDateString(tag, { month: "short", day: "numeric" }),
                })}
              </Text>
            </Row>
          )}

          {item.notes && (
            <View className="bg-bg3 rounded-xl px-3 py-2 mb-2">
              <Text className="text-txt3 text-[10px] font-bold tracking-wider mb-0.5">
                {t("tests.coachNotes").toUpperCase()}
              </Text>
              <Text className="text-txt2 text-xs">{item.notes}</Text>
            </View>
          )}

          {isDone && item.result && <ResultBlock result={item.result} tag={tag} t={t} />}
        </View>
      </Row>
    </View>
  );
}

function CustomTestCard({ item, tag, t }: { item: any; tag: string; t: (k: string, v?: any) => string }) {
  const scheme = useColorScheme();
  const isDone = item.status === "COMPLETED";
  const emoji = SPORT_EMOJI[item.customTest.sport ?? "General"] ?? "🏅";

  return (
    <View className={`rounded-3xl border p-5 ${isDone ? "bg-accent/6 border-accent-light/25" : "bg-bg2 border-bg5"}`}>
      <Row className="items-start gap-3">
        <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isDone ? "bg-accent/15" : "bg-violet-500/12"}`}>
          <Text className="text-2xl">{emoji}</Text>
        </View>

        <View className="flex-1">
          <Row className="items-center gap-2 mb-0.5">
            <Text className="text-txt font-bold text-base flex-1" numberOfLines={1}>
              {item.customTest.name}
            </Text>
            <StatusBadge done={isDone} t={t} />
          </Row>

          <Row className="items-center gap-1.5 mb-1">
            <Text className="text-txt3 text-xs">
              {t("tests.assignedBy", { name: item.coach.user.name })}
            </Text>
            <View className="bg-violet-500/15 rounded-full px-1.5 py-0.5">
              <Text className="text-violet-400 text-[9px] font-bold">
                {t("tests.customTest").toUpperCase()}
              </Text>
            </View>
          </Row>

          {item.customTest.description && (
            <Text className="text-txt2 text-xs leading-relaxed mb-2" numberOfLines={2}>
              {item.customTest.description}
            </Text>
          )}

          {item.scheduledAt && !isDone && (
            <Row className="items-center gap-1 mb-2">
              <Clock size={11} color={scheme === "dark" ? "#64748B" : "#94A3B8"} />
              <Text className="text-txt3 text-xs">
                {t("tests.scheduledFor", {
                  date: new Date(item.scheduledAt).toLocaleDateString(tag, { month: "short", day: "numeric" }),
                })}
              </Text>
            </Row>
          )}

          {item.customTest.movements?.length > 0 && (
            <View className="bg-bg3 rounded-xl px-3 py-2.5 mb-2 gap-1.5">
              <Row className="items-center gap-1.5 mb-1">
                <Layers size={10} color={scheme === "dark" ? "#94A3B8" : "#64748B"} />
                <Text className="text-txt3 text-[10px] font-bold tracking-wider">
                  {t("tests.movements").toUpperCase()}
                </Text>
              </Row>
              {item.customTest.movements.map((m: any, i: number) => {
                const spec = formatMovement(m);
                const movResult = item.movementResults?.find((r: any) => r.movementId === m.id);
                const pct = movResult ? calcMovementPct(m, movResult.value) : null;
                const color = pct !== null ? pctColor(pct) : undefined;

                return (
                  <Row key={m.id} className="items-start gap-2">
                    <View className="w-5 h-5 rounded-full bg-violet-500/20 items-center justify-center mt-0.5">
                      <Text className="text-violet-400 text-[9px] font-bold">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Row className="items-center gap-1.5">
                        <Text className="text-txt2 text-xs font-semibold flex-1">{m.name}</Text>
                        {pct !== null && (
                          <View style={{ backgroundColor: `${color}22`, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text style={{ color, fontSize: 9, fontWeight: "bold" }}>{Math.round(pct)}%</Text>
                          </View>
                        )}
                      </Row>
                      {spec ? <Text className="text-txt3 text-[10px]">{spec}</Text> : null}
                      {movResult ? (
                        <Text className="text-txt3 text-[10px]" style={{ color }}>
                          Actual: {movResult.value}{movResult.notes ? ` · ${movResult.notes}` : ""}
                        </Text>
                      ) : null}
                      {m.notes && !movResult ? (
                        <Text className="text-txt3 text-[10px] italic">{m.notes}</Text>
                      ) : null}
                    </View>
                  </Row>
                );
              })}
            </View>
          )}

          {item.notes && (
            <View className="bg-bg3 rounded-xl px-3 py-2 mb-2">
              <Text className="text-txt3 text-[10px] font-bold tracking-wider mb-0.5">
                {t("tests.coachNotes").toUpperCase()}
              </Text>
              <Text className="text-txt2 text-xs">{item.notes}</Text>
            </View>
          )}

          {isDone && item.result && (
            <View className="bg-accent/10 border border-accent-light/20 rounded-2xl px-4 py-3 mt-1">
              <Row className="items-center gap-2 mb-1">
                <CheckCircle2 size={13} color="#10B981" />
                <Text className="text-txt3 text-[10px] font-bold tracking-wider">
                  {t("tests.result").toUpperCase()}
                </Text>
                <Text className="text-txt3 text-[10px] ml-auto">
                  {t("tests.completedOn", {
                    date: new Date(item.result.completedAt).toLocaleDateString(tag, { month: "short", day: "numeric" }),
                  })}
                </Text>
              </Row>
              <Row className="items-end gap-1">
                <Text className="text-accent-light font-bold text-3xl">{item.result.value}</Text>
                <Text className="text-txt2 text-base font-semibold mb-0.5">{item.result.unit}</Text>
              </Row>
              {/* Per-movement percentage breakdown when unit is % */}
              {item.result.unit === "%" && item.customTest?.movements?.length > 0 && (
                <View className="mt-2 gap-1">
                  {item.customTest.movements.map((m: any) => {
                    const movResult = item.movementResults?.find((r: any) => r.movementId === m.id);
                    if (!movResult) return null;
                    const pct = calcMovementPct(m, movResult.value);
                    if (pct === null) return null;
                    const color = pctColor(pct);
                    const pctRounded = Math.round(pct);
                    const barWidth = Math.min(pctRounded, 100);
                    return (
                      <View key={m.id}>
                        <Row className="items-center gap-1.5 mb-0.5">
                          <Text className="text-txt3 text-[10px] flex-1" numberOfLines={1}>{m.name}</Text>
                          <Text style={{ color, fontSize: 10, fontWeight: "bold" }}>{pctRounded}%</Text>
                        </Row>
                        <View className="h-1 bg-bg5 rounded-full overflow-hidden">
                          <View style={{ width: `${barWidth}%`, backgroundColor: color, height: "100%", borderRadius: 99 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              {item.result.notes && (
                <Text className="text-txt3 text-xs mt-1">{item.result.notes}</Text>
              )}
            </View>
          )}
        </View>
      </Row>
    </View>
  );
}

function formatMovement(m: any): string {
  const parts = [
    m.sets ? `${m.sets} sets` : null,
    m.reps ? `× ${m.reps} reps` : null,
    m.distanceMeters
      ? m.distanceMeters >= 1000
        ? `${m.distanceMeters / 1000}km`
        : `${m.distanceMeters}m`
      : null,
    m.durationSeconds ? `${m.durationSeconds}s` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

function calcMovementPct(m: any, actual: number): number | null {
  if (actual <= 0) return null;
  if (m.durationSeconds != null && m.durationSeconds > 0) return (m.durationSeconds / actual) * 100;
  if (m.reps != null && m.sets != null) return (actual / (m.reps * m.sets)) * 100;
  if (m.reps != null) return (actual / m.reps) * 100;
  if (m.distanceMeters != null) return (actual / m.distanceMeters) * 100;
  if (m.sets != null) return (actual / m.sets) * 100;
  return null;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "#10B981";  // accent green
  if (pct >= 80) return "#F59E0B";   // amber
  return "#EF4444";                   // red
}

function ResultBlock({ result, tag, t }: { result: any; tag: string; t: (k: string, v?: any) => string }) {
  return (
    <View className="bg-accent/10 border border-accent-light/20 rounded-2xl px-4 py-3 mt-1">
      <Row className="items-center gap-2 mb-1">
        <CheckCircle2 size={13} color="#10B981" />
        <Text className="text-txt3 text-[10px] font-bold tracking-wider">
          {t("tests.result").toUpperCase()}
        </Text>
        <Text className="text-txt3 text-[10px] ml-auto">
          {t("tests.completedOn", {
            date: new Date(result.completedAt).toLocaleDateString(tag, { month: "short", day: "numeric" }),
          })}
        </Text>
      </Row>
      <Text className="text-accent-light font-bold text-2xl">
        {result.value}{" "}
        <Text className="text-txt2 text-sm font-normal">{result.unit}</Text>
      </Text>
      {result.notes && <Text className="text-txt3 text-xs mt-1">{result.notes}</Text>}
    </View>
  );
}

function StatusBadge({ done, t }: { done: boolean; t: (k: string) => string }) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${done ? "bg-accent/15" : "bg-amber-500/15"}`}>
      <Text className={`text-[9px] font-bold tracking-wider ${done ? "text-accent-light" : "text-amber-500"}`}>
        {done ? t("tests.completed").toUpperCase() : t("tests.pending").toUpperCase()}
      </Text>
    </View>
  );
}
