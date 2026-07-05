import { useState } from "react";
import { ScrollView, View, Text, ActivityIndicator, Alert, RefreshControl, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, MapPin, Timer, CheckCircle2 } from "lucide-react-native";
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

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TrainingScreen() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const todayDate = startOfDay(new Date());
  const isToday = selectedDate.getTime() === todayDate.getTime();
  const dateKey = toDateKey(selectedDate);

  const utils = trpc.useUtils();

  // Use the dedicated today endpoint for today (full exercise detail),
  // and myBookings filtered by date for history.
  const { data: todayData, isLoading: todayLoading } = trpc.sessions.today.useQuery(undefined, {
    enabled: isToday,
  });
  const { data: bookings, isLoading: bookingsLoading } = trpc.sessions.myBookings.useQuery(undefined, {
    enabled: !isToday,
  });

  const isLoading = isToday ? todayLoading : bookingsLoading;

  const sessionData = isToday
    ? (todayData ?? null)
    : (bookings?.find((b: any) => toDateKey(new Date(b.session.scheduledAt)) === dateKey) ?? null);

  const toggleProgress = trpc.progress.toggle.useMutation({
    onSuccess: () => {
      if (isToday) {
        utils.sessions.today.invalidate();
      } else {
        utils.sessions.myBookings.invalidate();
      }
      utils.progress.stats.invalidate();
      haptic.success();
    },
    onError: (e: any) => Alert.alert(t("training.couldntUpdate"), e.message),
  });

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      isToday ? utils.sessions.today.invalidate() : utils.sessions.myBookings.invalidate(),
      utils.progress.stats.invalidate(),
    ]),
  );

  const [expanded, setExpanded] = useState<string | null>(null);

  const goToPrevDay = () => {
    haptic.light();
    setSelectedDate((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return prev;
    });
  };

  const goToNextDay = () => {
    haptic.light();
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const goToToday = () => {
    haptic.light();
    setSelectedDate(startOfDay(new Date()));
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#3B82F6" size="large" />
      </View>
    );
  }

  const dateNavRow = (
    <Row className="items-center justify-between px-5" style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}>
      <PressableScale
        onPress={goToPrevDay}
        hapticType="light"
        className="w-9 h-9 items-center justify-center rounded-full bg-white/15"
      >
        <ChevronLeft size={18} color="#FFFFFF" />
      </PressableScale>

      <PressableScale onPress={isToday ? undefined : goToToday} hapticType={isToday ? undefined : "light"}>
        <View className="items-center gap-0.5">
          <Text className="text-white font-bold text-base">
            {isToday ? t("training.today") : formatDate(selectedDate, tag)}
          </Text>
          {!isToday && (
            <Text className="text-white/60 text-[10px]">{t("training.backToToday")}</Text>
          )}
        </View>
      </PressableScale>

      <PressableScale
        onPress={goToNextDay}
        hapticType="light"
        className="w-9 h-9 items-center justify-center rounded-full bg-white/15"
      >
        <ChevronRight size={18} color="#FFFFFF" />
      </PressableScale>
    </Row>
  );

  if (!sessionData) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
        <LinearGradient
          colors={gradients.ocean as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 64 }}
        />
        {dateNavRow}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 rounded-full bg-bg3 items-center justify-center mb-4">
            <Text className="text-5xl">🏖️</Text>
          </View>
          <Text className="text-txt font-bold text-2xl mb-2">{t("training.restDayTitle")}</Text>
          <Text className="text-txt2 text-sm text-center leading-relaxed">
            {isToday
              ? t("training.restDayDesc")
              : t("training.restDayDescDate", { date: formatDate(selectedDate, tag) })}
          </Text>
        </View>
      </View>
    );
  }

  const exercises = sessionData.session.exercises;
  const progressMap = new Map<string, any>(sessionData.progress.map((p: any) => [p.exerciseId, p]));
  const doneCount = sessionData.progress.filter((p: any) => p.completed).length;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const ringPct = exercises.length > 0 ? doneCount / exercises.length : 0;

  const toggle = (exerciseId: string, current: boolean) => {
    haptic.light();
    toggleProgress.mutate({ bookingId: sessionData.id, exerciseId, completed: !current });
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
      <View style={{ height: 290 + insets.top }}>
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

        {/* Date navigation */}
        {dateNavRow}

        <Animated.View
          entering={FadeInUp.duration(450)}
          style={{ paddingHorizontal: 20, gap: 6 }}
        >
          <Text className="text-white/80 text-[10px] tracking-widest font-bold">
            {sessionData.session.sport.toUpperCase()}
          </Text>
          <Text className="text-white font-bold text-3xl text-start" numberOfLines={2}>
            {sessionData.session.title}
          </Text>
          <Text className="text-white/85 text-sm">
            {t("training.withCoach", { name: sessionData.session.coach.user.name })}
          </Text>

          {/* chips */}
          <Row className="gap-2 mt-3 flex-wrap">
            <Chip icon={<Clock size={12} color="#FFFFFF" />}>
              {t("common.minutes", { count: sessionData.session.durationMinutes })}
            </Chip>
            <Chip icon={<MapPin size={12} color="#FFFFFF" />}>
              {sessionData.session.location ?? t("training.locationTbd")}
            </Chip>
            <Chip icon={<Timer size={12} color="#FFFFFF" />}>
              {formatTime(sessionData.session.scheduledAt, tag)}
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

        {/* Read-only banner for past sessions */}
        {!isToday && (
          <View className="bg-bg3 border border-bg5 rounded-2xl px-4 py-3 mb-4 flex-row items-center gap-2.5">
            <Text className="text-base">🔒</Text>
            <View className="flex-1">
              <Text className="text-txt font-semibold text-xs text-start">{t("training.viewOnlyBanner")}</Text>
              <Text className="text-txt3 text-[11px] text-start mt-0.5">{t("training.viewOnlyHint")}</Text>
            </View>
          </View>
        )}

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
                      onPress={isToday ? () => toggle(ex.id, done) : undefined}
                      hapticType={isToday ? "light" : undefined}
                      scaleTo={0.85}
                      hitSlop={10}
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        done ? "bg-accent-light" : "border-2 border-bg5 bg-bg3"
                      } ${!isToday ? "opacity-40" : ""}`}
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

        {/* Complete — only shown for today's session */}
        {isToday && (
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
        )}
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
