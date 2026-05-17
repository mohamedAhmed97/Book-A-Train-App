import { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };

function formatTime(d: Date, locale: string) {
  return new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function TrainingScreen() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];

  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.sessions.today.useQuery();
  const toggleProgress = trpc.progress.toggle.useMutation({
    onSuccess: () => {
      utils.sessions.today.invalidate();
      utils.progress.stats.invalidate();
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
        <ActivityIndicator color="#42A5F5" size="large" />
      </View>
    );
  }

  if (!today) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <StatusBar style="light" />
        <Text className="text-5xl mb-4">🏖️</Text>
        <Text className="text-txt font-bold text-xl mb-2">{t("training.restDayTitle")}</Text>
        <Text className="text-txt2 text-sm text-center leading-relaxed">{t("training.restDayDesc")}</Text>
      </View>
    );
  }

  const exercises = today.session.exercises;
  const progressMap = new Map<string, any>(today.progress.map((p: any) => [p.exerciseId, p]));
  const doneCount = today.progress.filter((p: any) => p.completed).length;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const ringPct = exercises.length > 0 ? (doneCount / exercises.length) * 100 : 0;

  const toggle = (exerciseId: string, current: boolean) => {
    toggleProgress.mutate({ bookingId: today.id, exerciseId, completed: !current });
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#42A5F5" colors={["#42A5F5"]} />}
    >
      <StatusBar style="light" />
      <View className="px-4 pt-14">

        {/* Hero card */}
        <View className="bg-bg3 border border-bg5 rounded-2xl p-5 mb-5">
          <Row className="items-start justify-between mb-3">
            <View className="flex-1">
              <Text className="text-txt2 text-xs tracking-widest mb-1 text-start">{today.session.sport.toUpperCase()}</Text>
              <Text className="text-txt font-bold text-2xl mb-1 text-start">{today.session.title}</Text>
              <Text className="text-txt2 text-xs text-start">{t("training.withCoach", { name: today.session.coach.user.name })}</Text>
            </View>
            {/* Progress ring */}
            <View className="w-14 h-14 items-center justify-center">
              <View className="absolute inset-0 rounded-full border-4 border-bg4" />
              <View
                className="absolute inset-0 rounded-full border-4 border-accent-light"
                style={{ opacity: ringPct / 100 }}
              />
              <Text className="text-accent-light font-bold text-sm">{doneCount}</Text>
              <Text className="text-txt3 text-[8px]">{t("training.doneLabel")}</Text>
            </View>
          </Row>

          {/* flexDirection: "row" auto-flips in RTL — no manual conditional needed. */}
          <View className="flex-row flex-wrap gap-2">
            {[
              { icon: "⏱", label: t("common.minutes", { count: today.session.durationMinutes }) },
              { icon: "📍", label: today.session.location ?? t("training.locationTbd") },
              { icon: "🕐", label: formatTime(today.session.scheduledAt, tag) },
            ].map((chip) => (
              <Row key={chip.label} className="items-center gap-1.5 bg-bg4 rounded-lg px-2.5 py-1.5">
                <Text className="text-xs">{chip.icon}</Text>
                <Text className="text-txt2 text-xs">{chip.label}</Text>
              </Row>
            ))}
          </View>
        </View>

        {/* Exercise list */}
        <Text className="text-txt3 text-[10px] tracking-widest mb-2.5">{t("training.exercises")}</Text>

        <View className="gap-2 mb-5">
          {exercises.map((ex: any) => {
            const prog = progressMap.get(ex.id);
            const done = prog?.completed ?? false;
            const isOpen = expanded === ex.id;

            return (
              <TouchableOpacity
                key={ex.id}
                className={`rounded-xl overflow-hidden ${done ? "border border-accent-light/20" : "border border-bg5"}`}
                style={{ backgroundColor: done ? "rgba(0,137,123,0.06)" : "#0D1526" }}
                onPress={() => setExpanded(isOpen ? null : ex.id)}
                activeOpacity={0.85}
              >
                {/* Accent bar on the leading edge of completed rows. */}
                {done && (
                  <View
                    className="absolute top-0 bottom-0 w-0.5 bg-accent-light"
                    style={{ start: 0 }}
                  />
                )}
                <Row className="items-center gap-3 p-3.5">
                  {/* Check button */}
                  <TouchableOpacity
                    className={`w-7 h-7 rounded-full border-2 items-center justify-center ${done ? "bg-accent-light border-accent-light" : "border-bg4"}`}
                    onPress={() => toggle(ex.id, done)}
                    hitSlop={10}
                  >
                    {done && <Text className="text-bg text-xs font-bold">✓</Text>}
                  </TouchableOpacity>

                  <View className="flex-1">
                    <Text
                      className={`text-sm font-medium mb-0.5 text-start ${done ? "line-through text-txt2" : "text-txt"}`}
                    >{ex.name}</Text>
                    <Text className="text-txt3 text-xs text-start">
                      {[
                        ex.sets && t("training.exerciseSets", { count: ex.sets }),
                        ex.reps && t("training.exerciseReps", { count: ex.reps }),
                        ex.durationSeconds && t("training.exerciseDuration", { seconds: ex.durationSeconds }),
                      ].filter(Boolean).join(" · ")}
                    </Text>
                  </View>

                  {ex.restSeconds && (
                    <Text className="text-txt2 text-xs">{t("training.exerciseRest", { seconds: ex.restSeconds })}</Text>
                  )}
                  <Text className="text-txt3 text-base">{isOpen ? "▲" : "▽"}</Text>
                </Row>

                {isOpen && ex.notes && (
                  <View className="px-4 pb-3 border-t border-bg5">
                    <Text className="text-txt2 text-xs leading-relaxed mt-2 text-start">
                      {t("training.noteIcon", { note: ex.notes })}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Complete button */}
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${allDone ? "bg-accent" : "bg-bg3"}`}
          disabled={!allDone}
          activeOpacity={0.8}
          onPress={() => {
            if (!allDone) return;
            Alert.alert(t("training.completeAlertTitle"), t("training.completeAlertMessage"), [
              { text: t("common.done"), onPress: () => router.push("/(tabs)") },
            ]);
          }}
        >
          <Text className={`font-bold text-sm ${allDone ? "text-bg" : "text-txt3"}`}>
            {allDone
              ? t("training.sessionComplete")
              : t("training.completeProgress", { done: doneCount, total: exercises.length })}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
