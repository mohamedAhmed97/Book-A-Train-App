import { useState } from "react";
import { ScrollView, View, Text, ActivityIndicator, Alert, RefreshControl, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronUp, Clock, MapPin, Timer, CheckCircle2 } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { PressableScale } from "@/components/ui/pressable-scale";
import { ProgressBar } from "@/components/ui/progress-bar";
import { haptic } from "@/lib/haptics";
import { gradients } from "@/lib/gradients";

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };
function formatTime(d: Date, locale: string) {
  return new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function TrainingScreen() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.sessions.today.useQuery();
  const toggleProgress = trpc.progress.toggle.useMutation({
    onSuccess: () => {
      utils.sessions.today.invalidate();
      utils.progress.stats.invalidate();
      haptic.success();
    },
    onError: (e: any) => Alert.alert(t("training.couldntUpdate"), e.message),
  });

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([utils.sessions.today.invalidate(), utils.progress.stats.invalidate()]),
  );

  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  if (!today) {
    return (
      <View
        className="flex-1 bg-bg items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <View className="w-24 h-24 rounded-full bg-bg3 items-center justify-center mb-4">
          <Text className="text-5xl">🏖️</Text>
        </View>
        <Text className="text-txt font-bold text-2xl mb-2">{t("training.restDayTitle")}</Text>
        <Text className="text-txt2 text-sm text-center leading-relaxed">{t("training.restDayDesc")}</Text>
      </View>
    );
  }

  const exercises = today.session.exercises;
  const progressMap = new Map<string, any>(today.progress.map((p: any) => [p.exerciseId, p]));
  const doneCount = today.progress.filter((p: any) => p.completed).length;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const ringPct = exercises.length > 0 ? doneCount / exercises.length : 0;

  const toggle = (exerciseId: string, current: boolean) => {
    haptic.light();
    toggleProgress.mutate({ bookingId: today.id, exerciseId, completed: !current });
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />

      {/* Hero */}
      <View style={{ height: 240 + insets.top }}>
        <LinearGradient
          colors={gradients.ocean as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          className="absolute w-72 h-72 rounded-full"
          style={{ top: -100, end: -90, backgroundColor: "rgba(255,255,255,0.15)" }}
        />
        <Animated.View
          entering={FadeInUp.duration(450)}
          style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, gap: 6 }}
        >
          <Text className="text-white/80 text-[10px] tracking-widest font-bold">
            {today.session.sport.toUpperCase()}
          </Text>
          <Text className="text-white font-bold text-3xl text-start" numberOfLines={2}>
            {today.session.title}
          </Text>
          <Text className="text-white/85 text-sm">
            {t("training.withCoach", { name: today.session.coach.user.name })}
          </Text>

          {/* chips */}
          <Row className="gap-2 mt-3 flex-wrap">
            <Chip icon={<Clock size={12} color="#FFFFFF" />}>
              {t("common.minutes", { count: today.session.durationMinutes })}
            </Chip>
            <Chip icon={<MapPin size={12} color="#FFFFFF" />}>
              {today.session.location ?? t("training.locationTbd")}
            </Chip>
            <Chip icon={<Timer size={12} color="#FFFFFF" />}>
              {formatTime(today.session.scheduledAt, tag)}
            </Chip>
          </Row>
        </Animated.View>
      </View>

      {/* Progress card overlapping hero */}
      <View className="px-5 -mt-10">
        <View className="bg-bg2 border border-bg5 rounded-3xl p-5 mb-5" style={{ elevation: 4 }}>
          <Row className="justify-between items-center mb-3">
            <View>
              <Text className="text-txt3 text-[10px] tracking-widest font-bold">
                {t("training.exercises").toUpperCase()}
              </Text>
              <Text className="text-txt font-bold text-2xl mt-1">
                {doneCount}<Text className="text-txt3 text-base">/{exercises.length}</Text>
              </Text>
            </View>
            <View className="w-14 h-14 rounded-full items-center justify-center bg-accent/15">
              <Text className="text-accent-light font-bold text-base">
                {Math.round(ringPct * 100)}%
              </Text>
            </View>
          </Row>
          <ProgressBar value={ringPct} gradient="forest" height={8} />
        </View>

        {/* Exercise list */}
        <View className="gap-2.5 mb-6">
          {exercises.map((ex: any, idx: number) => {
            const prog = progressMap.get(ex.id);
            const done = prog?.completed ?? false;
            const isOpen = expanded === ex.id;

            return (
              <Animated.View key={ex.id} entering={FadeInUp.delay(idx * 40).duration(350)}>
                <PressableScale
                  onPress={() => setExpanded(isOpen ? null : ex.id)}
                  hapticType="selection"
                  className={`rounded-2xl overflow-hidden border ${done ? "border-accent-light/30 bg-accent/8" : "border-bg5 bg-bg2"}`}
                >
                  {done && (
                    <View
                      className="absolute top-0 bottom-0 w-1 bg-accent-light"
                      style={{ start: 0 }}
                    />
                  )}
                  <Row className="items-center gap-3 p-3.5">
                    <PressableScale
                      onPress={() => toggle(ex.id, done)}
                      hapticType="light"
                      scaleTo={0.85}
                      hitSlop={10}
                      className={`w-8 h-8 rounded-full items-center justify-center ${done ? "bg-accent-light" : "border-2 border-bg5 bg-bg3"}`}
                    >
                      {done && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                    </PressableScale>

                    <View className="flex-1">
                      <Text
                        className={`text-sm font-bold mb-0.5 text-start ${done ? "line-through text-txt2" : "text-txt"}`}
                      >
                        {ex.name}
                      </Text>
                      <Text className="text-txt3 text-xs text-start">
                        {[
                          ex.sets && t("training.exerciseSets", { count: ex.sets }),
                          ex.reps && t("training.exerciseReps", { count: ex.reps }),
                          ex.durationSeconds && t("training.exerciseDuration", { seconds: ex.durationSeconds }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>

                    {ex.restSeconds && (
                      <View className="bg-bg3 rounded-full px-2 py-0.5">
                        <Text className="text-txt2 text-[10px] font-semibold">
                          {t("training.exerciseRest", { seconds: ex.restSeconds })}
                        </Text>
                      </View>
                    )}
                    {isOpen ? (
                      <ChevronUp size={16} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
                    ) : (
                      <ChevronDown size={16} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
                    )}
                  </Row>

                  {isOpen && ex.notes && (
                    <View className="px-4 pb-3.5 border-t border-bg5">
                      <Text className="text-txt2 text-xs leading-relaxed mt-2.5 text-start">
                        {t("training.noteIcon", { note: ex.notes })}
                      </Text>
                    </View>
                  )}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {/* Complete */}
        <Button
          variant={allDone ? "gradient" : "secondary"}
          gradient="forest"
          size="lg"
          disabled={!allDone}
          onPress={() => {
            if (!allDone) return;
            haptic.success();
            Alert.alert(t("training.completeAlertTitle"), t("training.completeAlertMessage"), [
              { text: t("common.done"), onPress: () => router.push("/(tabs)" as never) },
            ]);
          }}
        >
          <Row className="items-center gap-2">
            {allDone && <CheckCircle2 size={18} color="#FFFFFF" />}
            <Text className={`font-bold text-sm ${allDone ? "text-white" : "text-txt2"}`}>
              {allDone
                ? t("training.sessionComplete")
                : t("training.completeProgress", { done: doneCount, total: exercises.length })}
            </Text>
          </Row>
        </Button>
      </View>
    </ScrollView>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Row className="items-center gap-1.5 bg-white/15 border border-white/25 rounded-full px-2.5 py-1.5">
      {icon}
      <Text className="text-white text-xs font-semibold">{children}</Text>
    </Row>
  );
}
