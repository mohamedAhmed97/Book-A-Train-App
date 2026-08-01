import { useState, useEffect, useRef } from "react";
import { ScrollView, View, Text, ActivityIndicator, Alert, RefreshControl, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Dumbbell, MapPin, Timer, CheckCircle2, Play, Antenna, Activity, Flame, Gauge, Waves } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { useWorkoutStore } from "@/stores/workoutStore";
import { startWorkout, stopWorkout, calculateMetrics, formatDuration, formatPace, GPS_SPORTS, LAP_SPORTS } from "@/lib/workoutTracker";
import { getDistance } from "geolib";
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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Live timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isTracking, startTime, coordinates, bookingId: trackingBookingId } = useWorkoutStore();

  useEffect(() => {
    if (isTracking && startTime) {
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, startTime]);

  const utils = trpc.useUtils();

  const { data: todayData, isLoading: todayLoading } = trpc.sessions.today.useQuery(undefined, {
    enabled: isToday,
  });
  const { data: bookings, isLoading: bookingsLoading } = trpc.sessions.myBookings.useQuery(undefined, {
    enabled: !isToday,
  });

  const isLoading = isToday ? todayLoading : bookingsLoading;

  // All bookings for the selected day — normalize to array defensively,
  // handling both the new array format and the legacy single-object format.
  const dayBookings: any[] = isToday
    ? (Array.isArray(todayData) ? todayData : todayData != null ? [todayData] : [])
    : (Array.isArray(bookings) ? bookings.filter((b: any) => toDateKey(new Date(b.session.scheduledAt)) === dateKey) : []);

  // Reset selection when the date changes
  useEffect(() => { setSelectedBookingId(null); }, [dateKey]);

  // Resolve which booking to show as the active session detail
  const sessionData: any | null = (() => {
    if (dayBookings.length === 0) return null;
    // If tracking, always show the session being tracked
    if (isTracking && trackingBookingId) {
      const tracked = dayBookings.find((b: any) => b.id === trackingBookingId);
      if (tracked) return tracked;
    }
    // Single session → show it directly without needing explicit selection
    if (dayBookings.length === 1) return dayBookings[0];
    // Multiple → wait for explicit tap
    if (selectedBookingId) return dayBookings.find((b: any) => b.id === selectedBookingId) ?? null;
    return null;
  })();

  const { data: workoutResult } = trpc.progress.getResult.useQuery(
    { bookingId: sessionData?.id ?? "" },
    { enabled: !!sessionData },
  );

  const toggleProgress = trpc.progress.toggle.useMutation({
    onSuccess: () => {
      if (isToday) utils.sessions.today.invalidate();
      else utils.sessions.myBookings.invalidate();
      utils.progress.stats.invalidate();
      haptic.success();
    },
    onError: (e: any) => Alert.alert(t("training.couldntUpdate"), e.message),
  });

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      utils.sessions.today.invalidate(),
      utils.sessions.myBookings.invalidate(),
      utils.progress.stats.invalidate(),
    ]),
  );

  const [expanded, setExpanded] = useState<string | null>(null);

  const goToPrevDay = () => { haptic.light(); setSelectedDate(d => { const p = new Date(d); p.setDate(p.getDate() - 1); return p; }); };
  const goToNextDay = () => { haptic.light(); setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); };
  const goToToday = () => { haptic.light(); setSelectedDate(startOfDay(new Date())); };

  const handleStartSession = async () => {
    if (!sessionData) return;
    haptic.medium();
    try {
      const ok = await startWorkout(sessionData.id, sessionData.session.sport);
      if (!ok) {
        Alert.alert(t("training.locationDeniedTitle"), t("training.locationDeniedHint"));
      }
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? "Could not start session");
    }
  };

  const handleCompleteSession = async () => {
    if (!sessionData) return;
    haptic.success();

    if (isTracking) {
      await stopWorkout();
    }

    const metrics = isTracking ? calculateMetrics() : { durationMs: 0 };
    const sport = sessionData.session.sport;

    router.push({
      pathname: "/session-summary" as any,
      params: {
        bookingId: sessionData.id,
        sessionTitle: sessionData.session.title,
        sport,
        durationMs: String(metrics.durationMs),
        distanceM: metrics.distanceM != null ? String(metrics.distanceM) : "",
        avgSpeedKph: metrics.avgSpeedKph != null ? String(metrics.avgSpeedKph) : "",
        avgPaceSecPerKm: metrics.avgPaceSecPerKm != null ? String(metrics.avgPaceSecPerKm) : "",
        calories: metrics.calories != null ? String(metrics.calories) : "",
        isLapSport: LAP_SPORTS.has(sport) ? "1" : "0",
      },
    });
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
      <PressableScale onPress={goToPrevDay} hapticType="light" className="w-9 h-9 items-center justify-center rounded-full bg-white/15">
        <ChevronLeft size={18} color="#FFFFFF" />
      </PressableScale>
      <PressableScale onPress={isToday ? undefined : goToToday} hapticType={isToday ? undefined : "light"}>
        <View className="items-center gap-0.5">
          <Text className="text-white font-bold text-base">
            {isToday ? t("training.today") : formatDate(selectedDate, tag)}
          </Text>
          {!isToday && <Text className="text-white/60 text-[10px]">{t("training.backToToday")}</Text>}
        </View>
      </PressableScale>
      <PressableScale onPress={goToNextDay} hapticType="light" className="w-9 h-9 items-center justify-center rounded-full bg-white/15">
        <ChevronRight size={18} color="#FFFFFF" />
      </PressableScale>
    </Row>
  );

  if (dayBookings.length === 0) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
        <LinearGradient
          colors={gradients.ocean as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 64 }}
        />
        {dateNavRow}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 rounded-full bg-bg3 items-center justify-center mb-4">
            <Text className="text-5xl">🏖️</Text>
          </View>
          <Text className="text-txt font-bold text-2xl mb-2">{t("training.restDayTitle")}</Text>
          <Text className="text-txt2 text-sm text-center leading-relaxed">
            {isToday ? t("training.restDayDesc") : t("training.restDayDescDate", { date: formatDate(selectedDate, tag) })}
          </Text>
        </View>
      </View>
    );
  }

  // Multiple sessions, none selected yet → show picker list
  if (!sessionData) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
        <LinearGradient
          colors={gradients.ocean as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 64 }}
        />
        {dateNavRow}

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-txt font-bold text-xl mb-1">{t("training.chooseSessions")}</Text>
          <Text className="text-txt3 text-sm mb-5">
            {t("training.sessionsScheduled", { count: dayBookings.length })}
          </Text>

          {dayBookings.map((b: any, idx: number) => (
            <Animated.View key={b.id} entering={FadeInUp.delay(idx * 60).duration(350)}>
              <PressableScale
                onPress={() => { haptic.medium(); setSelectedBookingId(b.id); }}
                hapticType="medium"
                className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-3"
              >
                <Row className="items-start gap-3">
                  {/* Icon + Time column */}
                  <View className="items-center gap-2">
                    <View className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl items-center justify-center">
                      <Dumbbell size={20} color="#3B82F6" />
                    </View>
                    <View className="items-center">
                      <Text className="text-primary font-bold text-sm leading-tight">
                        {new Date(b.session.scheduledAt).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: true }).split(" ")[0]}
                      </Text>
                      <Text className="text-primary/60 text-[9px] font-semibold tracking-wide">
                        {new Date(b.session.scheduledAt).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: true }).split(" ")[1] ?? ""}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-1">
                    <Text className="text-txt3 text-[10px] font-bold tracking-widest mb-0.5">
                      {b.session.sport.toUpperCase()}
                    </Text>
                    <Text className="text-txt font-bold text-base leading-tight">{b.session.title}</Text>
                    <Text className="text-txt3 text-xs mt-0.5">
                      {t("training.withCoach", { name: b.session.coach.user.name })}
                    </Text>

                    <Row className="gap-3 mt-2.5">
                      <Row className="items-center gap-1">
                        <Clock size={11} color="#64748B" />
                        <Text className="text-txt3 text-[11px]">{b.session.durationMinutes}m</Text>
                      </Row>
                      {b.session.exercises.length > 0 && (
                        <Row className="items-center gap-1">
                          <Activity size={11} color="#64748B" />
                          <Text className="text-txt3 text-[11px]">
                            {t("training.exercises_count", { count: b.session.exercises.length })}
                          </Text>
                        </Row>
                      )}
                      {b.session.location && (
                        <Row className="items-center gap-1">
                          <MapPin size={11} color="#64748B" />
                          <Text className="text-txt3 text-[11px]" numberOfLines={1}>{b.session.location}</Text>
                        </Row>
                      )}
                    </Row>
                  </View>

                  <ChevronRight size={18} color="#64748B" />
                </Row>
              </PressableScale>
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const exercises: any[] = sessionData.session?.exercises ?? [];
  const progressList: any[] = Array.isArray(sessionData.progress) ? sessionData.progress : [];
  const progressMap = new Map<string, any>(progressList.map((p: any) => [p.exerciseId, p]));
  const doneCount = progressList.filter((p: any) => p.completed).length;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const ringPct = exercises.length > 0 ? doneCount / exercises.length : 0;

  const isThisSessionTracking = isTracking && trackingBookingId === sessionData.id;
  const canEdit = isToday && !workoutResult;
  let liveDistanceKm: number | null = null;
  if (isThisSessionTracking && coordinates.length >= 2 && GPS_SPORTS.has(sessionData.session.sport)) {
    let totalM = 0;
    for (let i = 1; i < coordinates.length; i++) {
      totalM += getDistance(
        { latitude: coordinates[i - 1]!.latitude, longitude: coordinates[i - 1]!.longitude },
        { latitude: coordinates[i]!.latitude, longitude: coordinates[i]!.longitude },
      );
    }
    liveDistanceKm = totalM / 1000;
  }

  const toggle = (exerciseId: string, current: boolean) => {
    haptic.light();
    // Auto-start session tracking when the athlete first checks off an exercise
    if (canEdit && !isThisSessionTracking && !current) {
      startWorkout(sessionData.id, sessionData.session.sport).catch(() => {});
    }
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
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="absolute w-72 h-72 rounded-full" style={{ top: -100, end: -90, backgroundColor: "rgba(255,255,255,0.15)" }} />

        {dateNavRow}

        {/* Back to session list — shown when multiple sessions exist for the day */}
        {dayBookings.length > 1 && (
          <PressableScale
            onPress={() => { haptic.light(); setSelectedBookingId(null); }}
            hapticType="light"
            style={{ marginHorizontal: 20, marginBottom: 8, alignSelf: "flex-start" }}
          >
            <Row className="items-center gap-1 bg-white/15 border border-white/25 rounded-full px-3 py-1.5">
              <ChevronLeft size={13} color="#FFFFFF" />
              <Text className="text-white text-xs font-semibold">{t("training.backToSessions")}</Text>
            </Row>
          </PressableScale>
        )}

        <Animated.View entering={FadeInUp.duration(450)} style={{ paddingHorizontal: 20, gap: 6 }}>
          <Text className="text-white/80 text-[10px] tracking-widest font-bold">
            {sessionData.session.sport.toUpperCase()}
          </Text>
          <Text className="text-white font-bold text-3xl text-start" numberOfLines={2}>
            {sessionData.session.title}
          </Text>
          <Text className="text-white/85 text-sm">
            {t("training.withCoach", { name: sessionData.session.coach.user.name })}
          </Text>
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

      <View className="px-5 -mt-10">
        {/* Progress card */}
        <View className="bg-bg2 border border-bg5 rounded-3xl p-5 mb-4" style={{ elevation: 4 }}>
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
              <Text className="text-accent-light font-bold text-base">{Math.round(ringPct * 100)}%</Text>
            </View>
          </Row>
          <ProgressBar value={ringPct} gradient="forest" height={8} />
        </View>

        {/* GPS live tracker bar — only for today and not yet completed */}
        {canEdit && (
          isThisSessionTracking ? (
            <View className="bg-coral/10 border border-coral/30 rounded-2xl px-4 py-3 mb-4">
              <Row className="items-center gap-3">
                <View className="w-2 h-2 rounded-full bg-coral" style={{ shadowColor: "#EF4444", shadowRadius: 4, shadowOpacity: 0.8 }} />
                <Text className="text-coral font-bold text-xs tracking-widest">{t("training.recording")}</Text>
                <Text className="text-txt font-bold text-sm ml-auto">{formatDuration(elapsed)}</Text>
                {liveDistanceKm !== null && GPS_SPORTS.has(sessionData.session.sport) && (
                  <Text className="text-txt2 text-xs">{liveDistanceKm.toFixed(2)} km</Text>
                )}
              </Row>
            </View>
          ) : (
            <PressableScale
              onPress={handleStartSession}
              hapticType="medium"
              className="bg-primary/10 border border-primary/30 rounded-2xl px-4 py-3 mb-4"
            >
              <Row className="items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-txt font-bold text-sm">{t("training.startSession")}</Text>
                  <Text className="text-txt3 text-[11px]">
                    {GPS_SPORTS.has(sessionData.session.sport)
                      ? t("training.startSessionHintGps")
                      : t("training.startSessionHintTimer")}
                  </Text>
                </View>
                <Antenna size={16} color="#3B82F6" />
              </Row>
            </PressableScale>
          )
        )}

        {/* Read-only banner for past/future sessions */}
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
            const hasWod = !!ex.wodType && canEdit && !done;

            const WOD_ACCENT_COLOR: Record<string, string> = {
              AMRAP:    "#0EA5E9",
              FOR_TIME: "#10B981",
              EMOM:     "#A78BFA",
              TABATA:   "#F97316",
              MIX:      "#F59E0B",
            };
            const wodColor = WOD_ACCENT_COLOR[ex.wodType] ?? "#3B82F6";

            const handleWodPress = async () => {
              haptic.medium();
              // Auto-start session tracking when athlete opens a WOD timer
              if (canEdit && !isThisSessionTracking) {
                try { await startWorkout(sessionData.id, sessionData.session.sport); } catch {}
              }
              router.push({
                pathname: "/wod-timer" as any,
                params: {
                  bookingId: sessionData.id,
                  exerciseId: ex.id,
                  exerciseName: ex.name,
                  wodType: ex.wodType,
                  durationSeconds: ex.durationSeconds ? String(ex.durationSeconds) : "",
                  sets: ex.sets ? String(ex.sets) : "",
                  reps: ex.reps ? String(ex.reps) : "",
                },
              });
            };

            return (
              <Animated.View key={ex.id} entering={FadeInUp.delay(idx * 40).duration(350)}>
                <PressableScale
                  onPress={hasWod ? handleWodPress : () => setExpanded(isOpen ? null : ex.id)}
                  hapticType="selection"
                  className={`rounded-2xl overflow-hidden border ${done ? "border-accent-light/30 bg-accent/8" : hasWod ? "border-bg5 bg-bg2" : "border-bg5 bg-bg2"}`}
                  style={hasWod ? { borderColor: wodColor + "44" } : undefined}
                >
                  {done && <View className="absolute top-0 bottom-0 w-1 bg-accent-light" style={{ start: 0 }} />}
                  {hasWod && <View className="absolute top-0 bottom-0 w-1 rounded-l-2xl" style={{ start: 0, backgroundColor: wodColor }} />}

                  <Row className="items-center gap-3 p-3.5">
                    {/* Left: WOD badge OR checkbox */}
                    {ex.wodType ? (
                      done ? (
                        <View className="w-8 h-8 rounded-full items-center justify-center bg-accent-light">
                          <Check size={16} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      ) : (
                        <View
                          className="px-1.5 py-1 rounded-lg items-center justify-center"
                          style={{ backgroundColor: wodColor + "22", minWidth: 32 }}
                        >
                          <Text className="font-bold text-[10px] tracking-tight" style={{ color: wodColor }}>
                            {ex.wodType === "FOR_TIME" ? "TIME" : ex.wodType}
                          </Text>
                        </View>
                      )
                    ) : (
                      <PressableScale
                        onPress={canEdit ? () => toggle(ex.id, done) : undefined}
                        hapticType={canEdit ? "light" : undefined}
                        scaleTo={0.85}
                        hitSlop={10}
                        className={`w-8 h-8 rounded-full items-center justify-center ${done ? "bg-accent-light" : "border-2 border-bg5 bg-bg3"} ${!canEdit ? "opacity-40" : ""}`}
                      >
                        {done && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                      </PressableScale>
                    )}

                    <View className="flex-1">
                      <Text className={`text-sm font-bold mb-0.5 text-start ${done ? "line-through text-txt2" : "text-txt"}`}>
                        {ex.name}
                      </Text>
                      <Text className="text-txt3 text-xs text-start">
                        {[
                          ex.sets && t("training.exerciseSets", { count: ex.sets }),
                          ex.reps && t("training.exerciseReps", { count: ex.reps }),
                          ex.durationSeconds && t("training.exerciseDuration", { seconds: ex.durationSeconds }),
                        ].filter(Boolean).join(" · ")}
                      </Text>
                    </View>

                    {ex.restSeconds && (
                      <View className="bg-bg3 rounded-full px-2 py-0.5">
                        <Text className="text-txt2 text-[10px] font-semibold">
                          {t("training.exerciseRest", { seconds: ex.restSeconds })}
                        </Text>
                      </View>
                    )}

                    {/* Right: Play icon for WOD, chevron for normal */}
                    {hasWod ? (
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: wodColor + "22" }}
                      >
                        <Play size={14} color={wodColor} fill={wodColor} />
                      </View>
                    ) : isOpen ? (
                      <ChevronUp size={16} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
                    ) : (
                      <ChevronDown size={16} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
                    )}
                  </Row>

                  {/* Notes section — shown when expanded (only for non-WOD or done WOD) */}
                  {!hasWod && isOpen && ex.notes && (
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

        {/* Workout result card — shown whenever a saved result exists */}
        {workoutResult && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} className="mb-4">
            <View className="bg-bg2 border border-bg5 rounded-3xl p-5">
              <Row className="items-center gap-2 mb-4">
                <CheckCircle2 size={14} color="#10B981" />
                <Text className="text-txt3 text-[10px] tracking-widest font-bold">
                  {t("summary.metrics").toUpperCase()}
                </Text>
                <Text className="text-txt3 text-[10px] ml-auto">
                  {new Date(workoutResult.completedAt).toLocaleDateString(tag, { month: "short", day: "numeric" })}
                </Text>
              </Row>

              <Row className="flex-wrap gap-x-4 gap-y-4">
                <ResultTile
                  icon={<Clock size={16} color="#3B82F6" />}
                  label={t("summary.duration")}
                  value={formatDuration(workoutResult.durationMs)}
                  bg="bg-primary/10"
                />
                {workoutResult.distanceM != null && workoutResult.distanceM > 0 && (
                  <ResultTile
                    icon={<Activity size={16} color="#10B981" />}
                    label={t("summary.distance")}
                    value={`${(workoutResult.distanceM / 1000).toFixed(2)} km`}
                    bg="bg-accent/10"
                  />
                )}
                {workoutResult.avgPaceSecPerKm != null && (
                  <ResultTile
                    icon={<Timer size={16} color="#8B5CF6" />}
                    label={t("summary.pace")}
                    value={`${formatPace(workoutResult.avgPaceSecPerKm)} /km`}
                    bg="bg-purple-500/10"
                  />
                )}
                {workoutResult.avgSpeedKph != null && (
                  <ResultTile
                    icon={<Gauge size={16} color="#F59E0B" />}
                    label={t("summary.speed")}
                    value={`${workoutResult.avgSpeedKph} km/h`}
                    bg="bg-yellow-500/10"
                  />
                )}
                {workoutResult.laps != null && (
                  <ResultTile
                    icon={<Waves size={16} color="#06B6D4" />}
                    label={t("summary.laps")}
                    value={String(workoutResult.laps)}
                    bg="bg-cyan-500/10"
                  />
                )}
                {workoutResult.calories != null && (
                  <ResultTile
                    icon={<Flame size={16} color="#EF4444" />}
                    label={t("summary.calories")}
                    value={`${workoutResult.calories} kcal`}
                    bg="bg-red-500/10"
                  />
                )}
              </Row>

              {workoutResult.notes && (
                <View className="mt-4 pt-4 border-t border-bg5">
                  <Text className="text-txt3 text-[10px] tracking-widest font-bold mb-1.5">
                    {t("summary.notes").toUpperCase()}
                  </Text>
                  <Text className="text-txt2 text-sm leading-relaxed">{workoutResult.notes}</Text>
                </View>
              )}

              {/* View full summary button */}
              <PressableScale
                onPress={() => router.push({
                  pathname: "/session-summary" as any,
                  params: {
                    bookingId: sessionData.id,
                    sessionTitle: sessionData.session.title,
                    sport: sessionData.session.sport,
                    durationMs: String(workoutResult.durationMs),
                    distanceM: workoutResult.distanceM != null ? String(workoutResult.distanceM) : "",
                    avgSpeedKph: workoutResult.avgSpeedKph != null ? String(workoutResult.avgSpeedKph) : "",
                    avgPaceSecPerKm: workoutResult.avgPaceSecPerKm != null ? String(workoutResult.avgPaceSecPerKm) : "",
                    calories: workoutResult.calories != null ? String(workoutResult.calories) : "",
                    isLapSport: LAP_SPORTS.has(sessionData.session.sport) ? "1" : "0",
                    laps: workoutResult.laps != null ? String(workoutResult.laps) : "",
                    notes: workoutResult.notes ?? "",
                    readonly: "1",
                  },
                })}
                hapticType="light"
                className="mt-4 pt-4 border-t border-bg5 items-center"
              >
                <Text className="text-primary text-xs font-semibold">{t("common.view")} →</Text>
              </PressableScale>
            </View>
          </Animated.View>
        )}

        {/* Complete button — today only, hidden once workout result is saved */}
        {isToday && !workoutResult && (
          <Button
            variant={allDone ? "gradient" : "secondary"}
            gradient="forest"
            size="lg"
            disabled={!allDone}
            onPress={handleCompleteSession}
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

function ResultTile({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <View className="flex-1 min-w-[110px]">
      <View className={`w-9 h-9 rounded-xl ${bg} items-center justify-center mb-1.5`}>
        {icon}
      </View>
      <Text className="text-txt3 text-[10px] tracking-wide mb-0.5">{label.toUpperCase()}</Text>
      <Text className="text-txt font-bold text-sm">{value}</Text>
    </View>
  );
}
