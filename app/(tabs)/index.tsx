import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Check, ChevronRight, MapPin, Clock, Activity, Flame, Calendar, Trophy } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import { gradients } from "@/lib/gradients";

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
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];

  const utils = trpc.useUtils();
  const { data: today } = trpc.sessions.today.useQuery();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: coaches } = trpc.coaches.mine.useQuery();
  const { data: bookings } = trpc.sessions.myBookings.useQuery();
  const { data: notifCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      utils.sessions.today.invalidate(),
      utils.progress.stats.invalidate(),
      utils.coaches.mine.invalidate(),
      utils.sessions.myBookings.invalidate(),
      utils.notifications.unreadCount.invalidate(),
    ]),
  );

  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  const firstName = user?.name.split(" ")[0] ?? t("common.athlete");
  const doneCount = today?.progress.filter((p: any) => p.completed).length ?? 0;
  const totalCount = today?.session.exercises.length ?? 0;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const upcomingBookings = (bookings ?? []).filter((b: any) => {
    const scheduledAt = new Date(b.session.scheduledAt);
    if (scheduledAt < startOfToday) return false;
    if (scheduledAt < endOfToday) {
      const done = b.progress.filter((p: any) => p.completed).length;
      if (done === b.session.exercises.length && b.session.exercises.length > 0) return false;
    }
    if (selectedCoachId && b.session.coach?.id !== selectedCoachId) return false;
    return true;
  });

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />
      }
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />

      {/* Gradient hero header */}
      <View style={{ height: 280 + insets.top }}>
        <LinearGradient
          colors={gradients.hero as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          className="absolute w-72 h-72 rounded-full"
          style={{ top: -90, end: -80, backgroundColor: "rgba(255,255,255,0.15)" }}
        />
        <View
          className="absolute w-56 h-56 rounded-full"
          style={{ bottom: 0, start: -60, backgroundColor: "rgba(20,184,166,0.2)" }}
        />

        <Animated.View
          entering={FadeInDown.duration(450)}
          style={{ paddingTop: insets.top + 16, paddingHorizontal: 20 }}
        >
          <Row className="items-center justify-between mb-6">
            <View>
              <Text className="text-white/80 text-xs tracking-wider">
                {t(`home.${greetingKey()}`)}
              </Text>
              <Text className="text-white font-bold text-2xl mt-0.5">
                {firstName} 👋
              </Text>
            </View>
            <PressableScale
              onPress={() => router.push("/notifications" as never)}
              className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 items-center justify-center"
            >
              <Bell size={20} color="#FFFFFF" />
              {(notifCount?.count ?? 0) > 0 && (
                <View
                  className="absolute w-2.5 h-2.5 rounded-full bg-coral border-2 border-white"
                  style={{ top: 6, end: 6 }}
                />
              )}
            </PressableScale>
          </Row>

          {/* Today's plan hero */}
          {today ? (
            <PressableScale
              onPress={() => router.push("/(tabs)/training" as never)}
              hapticType="medium"
              className="bg-white/15 border border-white/25 rounded-3xl p-5"
            >
              <Row className="items-center gap-2 mb-2">
                <Flame size={14} color="#FEF9C3" fill="#FEF9C3" />
                <Text className="text-white/90 text-[10px] tracking-widest font-bold">
                  {t("home.todaysPlan").toUpperCase()}
                </Text>
              </Row>
              <Text className="text-white font-bold text-xl mb-1 text-start" numberOfLines={1}>
                {today.session.title}
              </Text>
              <Row className="items-center gap-3 mb-4 flex-wrap">
                <Row className="items-center gap-1">
                  <Clock size={11} color="#FFFFFFCC" />
                  <Text className="text-white/85 text-xs">
                    {t("common.minutes", { count: today.session.durationMinutes })}
                  </Text>
                </Row>
                <Row className="items-center gap-1">
                  <MapPin size={11} color="#FFFFFFCC" />
                  <Text className="text-white/85 text-xs" numberOfLines={1}>
                    {today.session.location ?? t("home.locationTbd")}
                  </Text>
                </Row>
                <Text className="text-white/85 text-xs">
                  {formatTime(today.session.scheduledAt, tag)}
                </Text>
              </Row>
              <ProgressBar value={progress} gradient="forest" height={6} />
              <Row className="justify-between mt-2">
                <Text className="text-white/85 text-xs">
                  {t("home.progress")}
                </Text>
                <Text className="text-white font-bold text-xs">
                  {t("home.doneOf", { done: doneCount, total: totalCount })}
                </Text>
              </Row>
            </PressableScale>
          ) : (
            <View className="bg-white/12 border border-white/20 rounded-3xl p-5 items-center">
              <Text className="text-3xl mb-1">😴</Text>
              <Text className="text-white font-bold text-base">{t("home.noSessionToday")}</Text>
              <Text className="text-white/80 text-xs mt-1">{t("home.restDayHint")}</Text>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Content */}
      <View className="px-5 -mt-6">
        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)}>
          <Row className="gap-2.5 mb-6">
            <StatCard
              value={stats?.totalSessions ?? 0}
              label={t("home.statSessions")}
              gradient="cool"
              icon={<Calendar size={14} color={scheme === "dark" ? "#5EEAD4" : "#0F766E"} />}
            />
            <StatCard
              value={stats?.thisWeekSessions ?? 0}
              label={t("home.statThisWeek")}
              gradient="warm"
              icon={<Flame size={14} color={scheme === "dark" ? "#FBBF24" : "#F59E0B"} />}
            />
            <StatCard
              value={stats?.completedExercises ?? 0}
              label={t("home.statExercises")}
              gradient="sunset"
              icon={<Activity size={14} color={scheme === "dark" ? "#A78BFA" : "#7C3AED"} />}
            />
          </Row>
        </Animated.View>

        {/* Coaches */}
        {coaches && coaches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(450)}>
            <Row className="items-center justify-between mb-3">
              <Text className="text-txt font-bold text-base text-start">{t("home.myCoaches")}</Text>
              <PressableScale
                hapticType="light"
                onPress={() => setSelectedCoachId(null)}
                className={`rounded-full border px-3 py-1 ${
                  selectedCoachId === null ? "bg-primary border-primary" : "bg-bg2 border-bg5"
                }`}
              >
                <Text className={`text-xs font-semibold ${selectedCoachId === null ? "text-white" : "text-txt2"}`}>
                  {t("common.all")}
                </Text>
              </PressableScale>
            </Row>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-6"
              contentContainerStyle={{ gap: 10, paddingEnd: 10 }}
            >
              {coaches.map((ca: any, i: number) => {
                const palette: any[] = ["hero", "warm", "cool", "sunset"];
                const coachName = ca.coach.user.name;
                const coachId = ca.coach.id;
                const isSelected = selectedCoachId === coachId;
                return (
                  <PressableScale
                    key={ca.id}
                    hapticType="light"
                    onPress={() => setSelectedCoachId(isSelected ? null : coachId)}
                    className={`w-40 rounded-2xl overflow-hidden border-2 ${
                      isSelected ? "border-primary" : "border-bg5"
                    }`}
                  >
                    <LinearGradient
                      colors={gradients[palette[i % palette.length] as keyof typeof gradients] as unknown as readonly [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ height: 56, padding: 12, justifyContent: "flex-end" }}
                    >
                      <View className="w-10 h-10 rounded-full bg-white/30 border-2 border-white/50 items-center justify-center">
                        <Text className="text-white font-bold text-sm">
                          {coachName
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </Text>
                      </View>
                      {isSelected && (
                        <View className="absolute top-2 end-2 w-5 h-5 rounded-full bg-primary items-center justify-center">
                          <Check size={11} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </LinearGradient>
                    <View className="bg-bg2 p-3">
                      <Text className="text-txt font-bold text-sm mb-0.5" numberOfLines={1}>
                        {coachName.split(" ")[0]}
                      </Text>
                      <Text className="text-txt3 text-[10px] mb-2" numberOfLines={1}>
                        {ca.coach.sport ?? t("common.coach")}
                      </Text>
                      <Row className="items-center gap-1 bg-emerald/15 self-start rounded-full px-2 py-0.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald" />
                        <Text className="text-emerald text-[9px] font-semibold">
                          {t("home.coachActive")}
                        </Text>
                      </Row>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Upcoming */}
        {upcomingBookings.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(450)}>
            <SectionHeader
              title={t("home.upcomingSessions")}
              action={t("home.viewAll")}
              onAction={() => router.push("/(tabs)/training" as never)}
            />
            <View className="gap-2.5">
              {upcomingBookings.slice(0, 4).map((b: any) => (
                <PressableScale
                  key={b.id}
                  onPress={() => router.push("/(tabs)/training" as never)}
                  className="bg-bg2 border border-bg5 rounded-2xl p-3.5"
                >
                  <Row className="items-center gap-3">
                    <View className="w-12 h-12 rounded-xl bg-primary/15 items-center justify-center">
                      <Trophy size={22} color="#3B82F6" />
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
                        })}{" "}
                        ·{" "}
                        {t("home.exercisesShort", { count: b.session.exercises.length })}
                      </Text>
                    </View>
                    <View className="rounded-full px-2.5 py-1 bg-primary/15">
                      <Text className="text-[9px] font-bold tracking-wider text-primary">
                        {t("home.statusUpcoming").toUpperCase()}
                      </Text>
                    </View>
                    <ChevronRight size={14} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
                  </Row>
                </PressableScale>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row className="items-center justify-between mb-3">
      <Text className="text-txt font-bold text-base text-start">{title}</Text>
      {action && (
        <PressableScale onPress={onAction} hapticType="selection">
          <Row className="items-center gap-1">
            <Text className="text-primary-light text-xs font-semibold">{action}</Text>
            <ChevronRight size={12} color="#3B82F6" />
          </Row>
        </PressableScale>
      )}
    </Row>
  );
}
