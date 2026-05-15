import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";

function greetingKey(): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  const h = new Date().getHours();
  if (h < 12) return "greetingMorning";
  if (h < 18) return "greetingAfternoon";
  return "greetingEvening";
}

function formatTime(d: Date, locale: string) {
  return new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
}

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];

  const utils = trpc.useUtils();
  const { data: today } = trpc.sessions.today.useQuery();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: coaches } = trpc.coaches.mine.useQuery();
  const { data: bookings } = trpc.sessions.myBookings.useQuery();
  const { data: notifCount } = trpc.notifications.unreadCount.useQuery();

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      utils.sessions.today.invalidate(),
      utils.progress.stats.invalidate(),
      utils.coaches.mine.invalidate(),
      utils.sessions.myBookings.invalidate(),
      utils.notifications.unreadCount.invalidate(),
    ]),
  );

  const firstName = user?.name.split(" ")[0] ?? t("common.athlete");

  const doneCount = today?.progress.filter((p: any) => p.completed).length ?? 0;
  const totalCount = today?.session.exercises.length ?? 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#42A5F5" colors={["#42A5F5"]} />}
    >
      <StatusBar style="light" />
      <View className="px-4 pt-14">

        {/* Header */}
        <Row className="items-center justify-between mb-4">
          <View>
            <Text className="text-txt2 text-xs mb-0.5">{t(`home.${greetingKey()}`)}</Text>
            <Text className="text-txt font-bold text-xl">{firstName}</Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-bg3 border border-bg5 items-center justify-center relative"
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text className="text-lg">🔔</Text>
            {(notifCount?.count ?? 0) > 0 && (
              <View
                className="absolute top-1.5 w-2 h-2 rounded-full bg-coral"
                style={{ end: 6 }}
              />
            )}
          </TouchableOpacity>
        </Row>

        {/* Today's plan card */}
        {today ? (
          <TouchableOpacity
            className="rounded-2xl p-4 mb-4 overflow-hidden"
            style={{ backgroundColor: "#0D2144", borderWidth: 1, borderColor: "rgba(66,165,245,0.18)" }}
            onPress={() => router.push("/(tabs)/training")}
            activeOpacity={0.85}
          >
            <Text className="text-primary-light text-xs tracking-widest mb-2">{t("home.todaysPlan")}</Text>
            <Text className="text-txt font-bold text-xl mb-1">{today.session.title}</Text>
            <Text className="text-txt2 text-xs mb-3">
              {today.session.coach.user.name} · {today.session.location ?? t("home.locationTbd")} · {formatTime(today.session.scheduledAt, tag)}
            </Text>
            <Row className="gap-3 mb-3">
              <Text className="text-txt2 text-xs">⏱ {t("common.minutes", { count: today.session.durationMinutes })}</Text>
              <Text className="text-txt2 text-xs">{t("home.exerciseCount", { count: totalCount })}</Text>
              <Text className="text-txt2 text-xs">🏊 {today.session.sport}</Text>
            </Row>
            {/* Progress bar */}
            <Row className="justify-between mb-1.5">
              <Text className="text-txt2 text-xs">{t("home.progress")}</Text>
              <Text className="text-accent-light text-xs font-bold">{t("home.doneOf", { done: doneCount, total: totalCount })}</Text>
            </Row>
            <View className="h-1.5 bg-bg4 rounded-full">
              <View className="h-1.5 rounded-full bg-primary-light" style={{ width: `${progress}%` }} />
            </View>
          </TouchableOpacity>
        ) : (
          <View
            className="rounded-2xl p-5 mb-4 items-center"
            style={{ backgroundColor: "#0D1526", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}
          >
            <Text className="text-3xl mb-2">😴</Text>
            <Text className="text-txt font-semibold">{t("home.noSessionToday")}</Text>
            <Text className="text-txt2 text-xs mt-1">{t("home.restDayHint")}</Text>
          </View>
        )}

        {/* Stats */}
        <Row className="gap-2 mb-5">
          {[
            { val: stats?.totalSessions ?? 0, label: t("home.statSessions") },
            { val: `${stats?.thisWeekSessions ?? 0}`, label: t("home.statThisWeek") },
            { val: stats?.completedExercises ?? 0, label: t("home.statExercises") },
          ].map((s) => (
            <View key={s.label} className="flex-1 bg-bg2 border border-bg5 rounded-xl p-3 items-center">
              <Text className="text-primary-light font-bold text-xl">{s.val}</Text>
              <Text className="text-txt3 text-[9px] tracking-wide mt-0.5">{s.label}</Text>
            </View>
          ))}
        </Row>

        {/* My coaches */}
        {coaches && coaches.length > 0 && (
          <>
            <Text className="text-txt font-bold text-base mb-3">{t("home.myCoaches")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              <Row className="gap-2.5">
                {coaches.map((ca: any) => (
                  <View key={ca.id} className="w-36 bg-bg2 border border-bg5 rounded-2xl p-3.5">
                    <View className="w-11 h-11 rounded-full bg-primary items-center justify-center mb-2">
                      <Text className="text-white font-bold text-sm">
                        {ca.coach.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </Text>
                    </View>
                    <Text className="text-txt font-bold text-sm mb-0.5">{ca.coach.user.name.split(" ")[0]}</Text>
                    <Text className="text-txt2 text-[10px] mb-2">{ca.coach.sport ?? t("common.coach")}</Text>
                    <View className="bg-accent/20 rounded-full px-2 py-0.5 self-start">
                      <Text className="text-accent-light text-[10px]">{t("home.coachActive")}</Text>
                    </View>
                  </View>
                ))}
              </Row>
            </ScrollView>
          </>
        )}

        {/* Upcoming sessions */}
        {bookings && bookings.length > 0 && (
          <>
            <Row className="justify-between items-center mb-3">
              <Text className="text-txt font-bold text-base">{t("home.upcomingSessions")}</Text>
              <Text className="text-primary-light text-xs">{t("home.viewAll")}</Text>
            </Row>
            <View className="gap-2">
              {bookings.slice(0, 4).map((b: any) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => router.push("/(tabs)/training")}
                  activeOpacity={0.8}
                >
                  <Row className="items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
                    <View className="w-10 h-10 rounded-xl bg-primary/20 items-center justify-center">
                      <Text className="text-lg">🏋️</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-txt text-sm font-medium mb-0.5 text-start">{b.session.title}</Text>
                      <Text className="text-txt3 text-xs text-start">
                        {new Date(b.session.scheduledAt).toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" })} · {t("home.exercisesShort", { count: b.session.exercises.length })}
                      </Text>
                    </View>
                    <View className="bg-primary/20 rounded-full px-2.5 py-1">
                      <Text className="text-primary-light text-[10px]">
                        {new Date(b.session.scheduledAt) < new Date() ? t("home.statusPast") : t("home.statusUpcoming")}
                      </Text>
                    </View>
                  </Row>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
