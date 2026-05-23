import { ScrollView, View, Text, RefreshControl, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Flame, TrendingUp, Calendar } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";
import { StatCard } from "@/components/ui/stat-card";
import { gradients } from "@/lib/gradients";

const SPORTS_EMOJI: Record<string, string> = {
  Swimming: "🏊", Running: "🏃", Football: "⚽", Cycling: "🚴", Basketball: "🏀",
};
const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };

export default function ActivityScreen() {
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  const utils = trpc.useUtils();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: bookings } = trpc.sessions.myBookings.useQuery();

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([utils.progress.stats.invalidate(), utils.sessions.myBookings.invalidate()]),
  );

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const minutesPerDay = [0, 0, 0, 0, 0, 0, 0];
  for (const b of bookings ?? []) {
    const d = new Date(b.session.scheduledAt);
    if (d < weekStart) continue;
    const dayIdx = d.getDay();
    minutesPerDay[dayIdx] = (minutesPerDay[dayIdx] ?? 0) + b.session.durationMinutes;
  }
  const maxMinutes = Math.max(...minutesPerDay, 1);
  const dayLabels = t("activity.dayLabels").split(",");
  const bars = dayLabels.map((day, i) => ({ day, h: Math.round(((minutesPerDay[i] ?? 0) / maxMinutes) * 100) }));
  const totalMinutes = minutesPerDay.reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
        <Text className="text-txt3 text-[11px] tracking-widest font-bold mb-1">
          {t("activity.title").toUpperCase()}
        </Text>
        <Text className="text-txt font-bold text-3xl mb-5">{t("activity.title")}</Text>

        {/* Chart card */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <View className="rounded-3xl overflow-hidden border border-bg5 mb-3">
            <LinearGradient
              colors={gradients.ocean as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20 }}
            >
              <Row className="justify-between items-start mb-4">
                <View>
                  <Text className="text-white/85 text-[10px] tracking-widest font-bold">
                    {t("activity.weeklyVolume").toUpperCase()}
                  </Text>
                  <Row className="items-baseline gap-1 mt-1">
                    <Text className="text-white font-bold text-3xl">{totalMinutes}</Text>
                    <Text className="text-white/80 text-sm">{t("common.min")}</Text>
                  </Row>
                </View>
                <Row className="items-center gap-1 bg-white/15 rounded-full px-2.5 py-1">
                  <TrendingUp size={11} color="#FFFFFF" />
                  <Text className="text-white text-[10px] font-bold tracking-wide">
                    {t("activity.thisWeek")}
                  </Text>
                </Row>
              </Row>

              {/* Bars */}
              <Row className="items-end gap-1.5 h-28 mb-2">
                {bars.map((b, i) => (
                  <View key={i} className="flex-1 items-center justify-end h-full">
                    <View
                      style={{
                        width: "100%",
                        height: b.h > 0 ? `${Math.max(b.h, 6)}%` : 0,
                        backgroundColor:
                          b.h === 100
                            ? "#FFFFFF"
                            : b.h > 60
                            ? "rgba(255,255,255,0.85)"
                            : "rgba(255,255,255,0.45)",
                        borderRadius: 6,
                      }}
                    />
                  </View>
                ))}
              </Row>
              <Row className="gap-1.5">
                {bars.map((b, i) => (
                  <Text key={i} className="flex-1 text-center text-white/80 text-[10px] font-semibold">
                    {b.day}
                  </Text>
                ))}
              </Row>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <Row className="gap-2 mb-6">
            <StatCard
              value={stats?.totalSessions ?? 0}
              label={t("activity.totalSessions")}
              gradient="hero"
              icon={<Calendar size={14} color="#3B82F6" />}
            />
            <StatCard
              value={stats?.completedExercises ?? 0}
              label={t("activity.exercisesDone")}
              gradient="forest"
              icon={<Activity size={14} color={scheme === "dark" ? "#5EEAD4" : "#14B8A6"} />}
            />
            <StatCard
              value={stats?.thisWeekSessions ?? 0}
              label={t("activity.thisWeekStat")}
              gradient="warm"
              icon={<Flame size={14} color={scheme === "dark" ? "#FBBF24" : "#F59E0B"} />}
            />
          </Row>
        </Animated.View>

        {/* History */}
        <Text className="text-txt font-bold text-base mb-3 text-start">
          {t("activity.sessionHistory")}
        </Text>
        {bookings?.length === 0 && (
          <Text className="text-txt2 text-sm text-center py-8">{t("activity.noSessions")}</Text>
        )}
        <View className="gap-2.5">
          {bookings?.map((b: any, i: number) => {
            const done = b.progress.filter((p: any) => p.completed).length;
            return (
              <Animated.View key={b.id} entering={FadeInUp.delay(i * 40).duration(350)}>
                <Row className="items-center gap-3 bg-bg2 border border-bg5 rounded-2xl p-3.5">
                  <View className="w-12 h-12 rounded-2xl bg-primary/15 items-center justify-center">
                    <Text className="text-xl">{SPORTS_EMOJI[b.session.sport] ?? "🏋️"}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-txt text-sm font-bold mb-0.5 text-start" numberOfLines={1}>
                      {b.session.title}
                    </Text>
                    <Text className="text-txt3 text-xs text-start">
                      {new Date(b.session.scheduledAt).toLocaleDateString(tag, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-primary-light font-bold text-sm">
                      {t("common.minShort", { count: b.session.durationMinutes })}
                    </Text>
                    <Text className="text-accent-light text-[10px] font-semibold">
                      {t("activity.doneOf", { done, total: b.session.exercises.length })}
                    </Text>
                  </View>
                </Row>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
