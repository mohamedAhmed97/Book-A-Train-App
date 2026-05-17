import { ScrollView, View, Text, RefreshControl } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";

const SPORTS_EMOJI: Record<string, string> = {
  Swimming: "🏊", Running: "🏃", Football: "⚽", Cycling: "🚴", Basketball: "🏀",
};

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };

export default function ActivityScreen() {
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];

  const utils = trpc.useUtils();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: bookings } = trpc.sessions.myBookings.useQuery();

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([utils.progress.stats.invalidate(), utils.sessions.myBookings.invalidate()]),
  );

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Minutes of training per weekday in the current week (Sun–Sat).
  const minutesPerDay = [0, 0, 0, 0, 0, 0, 0];
  for (const b of bookings ?? []) {
    const d = new Date(b.session.scheduledAt);
    if (d < weekStart) continue;
    const dayIdx = d.getDay();
    minutesPerDay[dayIdx] = (minutesPerDay[dayIdx] ?? 0) + b.session.durationMinutes;
  }
  const maxMinutes = Math.max(...minutesPerDay, 1);
  const dayLabels = t("activity.dayLabels").split(",");
  const bars = dayLabels.map((day, i) => ({
    day,
    h: Math.round(((minutesPerDay[i] ?? 0) / maxMinutes) * 100),
  }));

  const totalMinutes = minutesPerDay.reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#42A5F5" colors={["#42A5F5"]} />}
    >
      <StatusBar style="light" />
      <View className="px-4 pt-14">
        <Text className="text-txt font-bold text-xl mb-5 text-start">{t("activity.title")}</Text>

        {/* Weekly chart */}
        <View className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-3">
          <Row className="justify-between items-start mb-3">
            <View>
              <Text className="text-txt font-bold text-sm text-start">{t("activity.weeklyVolume")}</Text>
              <Text className="text-accent-light text-xs mt-0.5 text-start">
                {t("activity.weeklyMinutesTotal", { count: totalMinutes })}
              </Text>
            </View>
            <Text className="text-txt3 text-xs">{t("activity.thisWeek")}</Text>
          </Row>
          {/* Bar chart */}
          <Row className="items-end gap-1.5 h-20 mb-1.5">
            {bars.map((b, i) => (
              <View key={i} className="flex-1 items-center gap-1 h-full justify-end">
                <View
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${b.h}%`,
                    backgroundColor: b.h === 100 ? "#42A5F5" : b.h > 60 ? "#1565C0" : "#1A2840",
                    minHeight: b.h > 0 ? 4 : 0,
                  }}
                />
              </View>
            ))}
          </Row>
          <Row className="gap-1.5">
            {bars.map((b, i) => (
              <Text key={i} className="flex-1 text-center text-txt3 text-[9px]">{b.day}</Text>
            ))}
          </Row>
        </View>

        {/* Stats grid */}
        <Row className="gap-2 mb-5">
          {[
            { val: stats?.totalSessions ?? 0, label: t("activity.totalSessions"), color: "text-primary-light" },
            { val: stats?.completedExercises ?? 0, label: t("activity.exercisesDone"), color: "text-accent-light" },
            { val: stats?.thisWeekSessions ?? 0, label: t("activity.thisWeekStat"), color: "text-amber" },
          ].map((s) => (
            <View key={s.label} className="flex-1 bg-bg2 border border-bg5 rounded-xl p-3 items-center">
              <Text className={`font-bold text-2xl ${s.color} mb-1`}>{s.val}</Text>
              <Text className="text-txt3 text-[9px] tracking-wide text-center">{s.label}</Text>
            </View>
          ))}
        </Row>

        {/* Session history */}
        <Text className="text-txt font-bold text-base mb-3 text-start">{t("activity.sessionHistory")}</Text>
        {bookings?.length === 0 && (
          <Text className="text-txt2 text-sm text-center py-8">{t("activity.noSessions")}</Text>
        )}
        <View className="gap-2">
          {bookings?.map((b: any) => (
            <Row key={b.id} className="items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
              <View className="w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: "rgba(21,101,192,0.18)" }}>
                <Text className="text-xl">{SPORTS_EMOJI[b.session.sport] ?? "🏋️"}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-txt text-sm font-medium mb-0.5 text-start">{b.session.title}</Text>
                <Text className="text-txt3 text-xs text-start">
                  {new Date(b.session.scheduledAt).toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" })}
                </Text>
              </View>
              {/* items-end = "end of writing direction" — auto-flips in RTL. */}
              <View className="items-end">
                <Text className="text-primary-light font-bold text-sm">{t("common.minShort", { count: b.session.durationMinutes })}</Text>
                <Text className="text-accent-light text-[10px]">
                  {t("activity.doneOf", { done: b.progress.filter((p: any) => p.completed).length, total: b.session.exercises.length })}
                </Text>
              </View>
            </Row>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
