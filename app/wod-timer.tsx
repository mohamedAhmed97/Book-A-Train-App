import { useState, useEffect, useRef } from "react";
import { View, Text, Alert, AppState, AppStateStatus } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { ArrowLeft, CheckCircle, Plus, Minus, Play, Pause } from "lucide-react-native";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";
import { PressableScale } from "@/components/ui/pressable-scale";
import { haptic } from "@/lib/haptics";
import { gradients } from "@/lib/gradients";
import { Row } from "@/components/ui/row";
import { playBeep, playPhaseChange, playDone } from "@/lib/wodSounds";

type WodType = "AMRAP" | "FOR_TIME" | "EMOM" | "TABATA" | "MIX";

const WOD_GRADIENT: Record<WodType, readonly [string, string, ...string[]]> = {
  AMRAP:    gradients.ocean    as unknown as readonly [string, string, ...string[]],
  FOR_TIME: gradients.forest   as unknown as readonly [string, string, ...string[]],
  EMOM:     gradients.sunset   as unknown as readonly [string, string, ...string[]],
  TABATA:   gradients.fire     as unknown as readonly [string, string, ...string[]],
  MIX:      gradients.warm     as unknown as readonly [string, string, ...string[]],
};

const WOD_ACCENT: Record<WodType, string> = {
  AMRAP:    "#0EA5E9",
  FOR_TIME: "#10B981",
  EMOM:     "#A78BFA",
  TABATA:   "#F97316",
  MIX:      "#F59E0B",
};

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}
function formatMmSs(totalSec: number) {
  const t = Math.max(0, Math.floor(totalSec));
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

const BEEP_THRESHOLD = 3;

export default function WodTimerScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const {
    bookingId,
    exerciseId,
    exerciseName,
    wodType: rawWodType,
    durationSeconds: rawDuration,
    sets: rawSets,
    reps: rawReps,
  } = useLocalSearchParams<{
    bookingId: string;
    exerciseId: string;
    exerciseName: string;
    wodType: string;
    durationSeconds?: string;
    sets?: string;
    reps?: string;
  }>();

  const wodType = (rawWodType ?? "MIX") as WodType;
  const totalSec    = rawDuration ? parseInt(rawDuration) : 0;
  const sets        = rawSets     ? parseInt(rawSets)     : 0;
  const reps        = rawReps     ? parseInt(rawReps)     : 0;

  const amrapTotal   = totalSec > 0 ? totalSec  : 600;
  const emomTotal    = totalSec > 0 ? Math.floor(totalSec / 60) : sets > 0 ? sets : 10;
  const tabataRounds = sets > 0 ? sets : totalSec > 0 ? Math.max(1, Math.floor(totalSec / 30)) : 8;

  const [elapsed,  setElapsed]  = useState(0);
  const [running,  setRunning]  = useState(false);
  const [finished, setFinished] = useState(false);
  const [rounds,   setRounds]   = useState(0);

  // Stable refs
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef     = useRef<number | null>(null); // Date.now() − elapsed*1000 while running
  const elapsedRef     = useRef(0);                   // mirrors elapsed state for effect closures
  const finishedRef    = useRef(false);
  const beepedRef      = useRef(new Set<number>());   // elapsed-second values already beeped
  const prevTabataRef  = useRef<"WORK" | "REST" | "">("");
  const prevEmomMinRef = useRef(-1);
  const autoStartedRef = useRef(false);
  const notifIdRef     = useRef<string | null>(null);

  // Keep elapsedRef in sync with state (used by timer effect closure)
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Flash overlay animation
  const flashOpacity = useSharedValue(0);
  const flashStyle   = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const flashRef     = useRef(() => {
    flashOpacity.value = withSequence(
      withTiming(0.35, { duration: 60 }),
      withTiming(0,    { duration: 280 }),
    );
  });

  // ── Setup: audio mode + notification permission ──────────────────────────────
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    }).catch(() => {});

    Notifications.requestPermissionsAsync().catch(() => {});

    return () => { cancelDoneNotif(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-start ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    const id = setTimeout(() => setRunning(true), 300);
    return () => clearTimeout(id);
  }, []);

  // ── Notification helpers ─────────────────────────────────────────────────────
  const cancelDoneNotif = async () => {
    if (notifIdRef.current) {
      try { await Notifications.cancelScheduledNotificationAsync(notifIdRef.current); } catch {}
      notifIdRef.current = null;
    }
  };

  const scheduleDoneNotif = async (remainingSeconds: number) => {
    if (remainingSeconds <= 1) return;
    try {
      await cancelDoneNotif();
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time's Up! 🏋️",
          body: `${exerciseName} — ${wodType} complete`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.ceil(remainingSeconds),
          repeats: false,
        },
      });
      notifIdRef.current = id;
    } catch {}
  };

  // ── Per-tick sound/event logic (always-fresh via ref pattern) ────────────────
  const handleTickRef = useRef<(n: number) => void>(() => {});
  handleTickRef.current = (newElapsed: number) => {
    if (finishedRef.current) return;

    if (wodType === "AMRAP") {
      const remaining = amrapTotal - newElapsed;
      if (remaining > 0 && remaining <= BEEP_THRESHOLD && !beepedRef.current.has(newElapsed)) {
        beepedRef.current.add(newElapsed);
        playBeep(); haptic.warning();
      }
      if (remaining <= 0) { doFinish(); }
    }

    if (wodType === "TABATA") {
      const totalDur  = tabataRounds * 30;
      if (newElapsed >= totalDur) { doFinish(); return; }
      const posInCycle = newElapsed % 30;
      const phase      = posInCycle < 20 ? "WORK" : "REST";
      const phaseLeft  = phase === "WORK" ? 20 - posInCycle : 30 - posInCycle;
      if (phaseLeft > 0 && phaseLeft <= BEEP_THRESHOLD && !beepedRef.current.has(newElapsed)) {
        beepedRef.current.add(newElapsed);
        playBeep(); haptic.warning();
      }
      if (prevTabataRef.current && prevTabataRef.current !== phase) {
        flashRef.current(); playPhaseChange(); haptic.medium();
      }
      prevTabataRef.current = phase as "WORK" | "REST";
    }

    if (wodType === "EMOM") {
      const totalDur  = emomTotal * 60;
      if (newElapsed >= totalDur) { doFinish(); return; }
      const currentMin = Math.floor(newElapsed / 60);
      const secLeft    = 60 - (newElapsed % 60);
      if (currentMin !== prevEmomMinRef.current) {
        prevEmomMinRef.current = currentMin;
        flashRef.current(); playPhaseChange(); haptic.medium();
      }
      if (secLeft > 0 && secLeft <= BEEP_THRESHOLD && !beepedRef.current.has(newElapsed)) {
        beepedRef.current.add(newElapsed);
        playBeep(); haptic.warning();
      }
    }
  };

  const doFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setFinished(true);
    playDone();
    haptic.success();
    cancelDoneNotif();
  };

  // ── Main timer — wall-clock based so accuracy survives background/foreground ─
  useEffect(() => {
    if (!running || finished) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Clear timestamp on pause so resume resets it correctly
      if (!running && !finished) startTsRef.current = null;
      return;
    }

    // Anchor wall-clock reference to current elapsed (handles resume after pause)
    startTsRef.current = Date.now() - elapsedRef.current * 1000;

    // Schedule "done" local notification for timed modes
    const remaining = (() => {
      if (wodType === "AMRAP")  return amrapTotal   - elapsedRef.current;
      if (wodType === "EMOM")   return emomTotal * 60 - elapsedRef.current;
      if (wodType === "TABATA") return tabataRounds * 30 - elapsedRef.current;
      return 0;
    })();
    if (remaining > 1) scheduleDoneNotif(remaining);

    intervalRef.current = setInterval(() => {
      if (!startTsRef.current) return;
      const newElapsed = Math.floor((Date.now() - startTsRef.current) / 1000);
      setElapsed(newElapsed);
      handleTickRef.current(newElapsed);
    }, 500); // 500 ms keeps display snappy and halves any rounding drift

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, finished]);

  // ── AppState — recalculate elapsed when app is foregrounded ─────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && !finishedRef.current && startTsRef.current) {
        const newElapsed = Math.floor((Date.now() - startTsRef.current) / 1000);
        setElapsed(newElapsed);
        handleTickRef.current(newElapsed);
      }
    });
    return () => sub.remove();
  }, []); // mount-only; reads refs at call time

  // ── Controls ─────────────────────────────────────────────────────────────────
  const toggleRunning = () => {
    haptic.light();
    if (running) cancelDoneNotif(); // cancel notification on pause
    setRunning((r) => !r);
  };

  const toggleMut = trpc.progress.toggle.useMutation({
    onSuccess: () => {
      haptic.success();
      utils.sessions.today.invalidate();
      utils.sessions.myBookings.invalidate();
      // Navigate explicitly to training tab (not home)
      router.navigate("/(tabs)/training" as any);
    },
    onError: (e: any) => Alert.alert(t("common.error"), e.message),
  });

  const markDone = () => {
    setRunning(false);
    cancelDoneNotif();
    toggleMut.mutate({ bookingId, exerciseId, completed: true });
  };

  const confirmBack = () => {
    if (running) {
      Alert.alert("Stop Timer?", "The timer is still running. Go back anyway?", [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Go Back", style: "destructive",
          onPress: () => { setRunning(false); cancelDoneNotif(); router.back(); },
        },
      ]);
    } else {
      router.back();
    }
  };

  // ── Derived display values ───────────────────────────────────────────────────
  const display = (() => {
    if (wodType === "AMRAP") {
      const remaining = Math.max(0, amrapTotal - elapsed);
      return { clock: formatMmSs(remaining), progress: elapsed / amrapTotal, phase: null, isWork: null };
    }
    if (wodType === "FOR_TIME" || wodType === "MIX") {
      return { clock: formatMmSs(elapsed), progress: null, phase: null, isWork: null };
    }
    if (wodType === "EMOM") {
      const secInMin = elapsed % 60;
      const secLeft  = 60 - secInMin;
      const curMin   = Math.min(Math.floor(elapsed / 60) + 1, emomTotal);
      return {
        clock:    formatMmSs(secLeft),
        progress: elapsed / (emomTotal * 60),
        phase:    `${t("wod.minute")} ${curMin} ${t("wod.of")} ${emomTotal}`,
        isWork:   null,
      };
    }
    if (wodType === "TABATA") {
      const posInCycle = elapsed % 30;
      const isWork     = posInCycle < 20;
      const phaseLeft  = isWork ? 20 - posInCycle : 30 - posInCycle;
      const curRound   = Math.min(Math.floor(elapsed / 30) + 1, tabataRounds);
      return {
        clock:    formatMmSs(phaseLeft),
        progress: elapsed / (tabataRounds * 30),
        phase:    `${t("wod.round")} ${curRound} ${t("wod.of")} ${tabataRounds}`,
        isWork,
      };
    }
    return { clock: "00:00", progress: null, phase: null, isWork: null };
  })();

  const accent = WOD_ACCENT[wodType];

  const bgGradient: readonly [string, string, ...string[]] =
    wodType === "TABATA" && display.isWork !== null
      ? display.isWork
        ? gradients.fire   as unknown as readonly [string, string, ...string[]]
        : gradients.forest as unknown as readonly [string, string, ...string[]]
      : WOD_GRADIENT[wodType];

  const wodLabel: Record<WodType, string> = {
    AMRAP: t("wod.amrap"), FOR_TIME: t("wod.forTime"), EMOM: t("wod.emom"),
    TABATA: t("wod.tabata"), MIX: t("wod.mix"),
  };
  const wodDesc: Record<WodType, string> = {
    AMRAP: t("wod.amrapDesc"), FOR_TIME: t("wod.forTimeDesc"), EMOM: t("wod.emomDesc"),
    TABATA: t("wod.tabataDesc"), MIX: t("wod.mixDesc"),
  };

  const isWarning = (() => {
    if (finished) return false;
    if (wodType === "AMRAP") return (amrapTotal - elapsed) <= BEEP_THRESHOLD;
    if (wodType === "EMOM")  return (60 - (elapsed % 60)) <= BEEP_THRESHOLD;
    if (wodType === "TABATA") {
      const pos = elapsed % 30;
      return (pos < 20 ? 20 - pos : 30 - pos) <= BEEP_THRESHOLD;
    }
    return false;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1">
      <StatusBar style="light" />

      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />

      <View className="absolute w-72 h-72 rounded-full"
        style={{ top: -100, end: -80, backgroundColor: "rgba(255,255,255,0.08)" }} />
      <View className="absolute w-48 h-48 rounded-full"
        style={{ bottom: 60, start: -60, backgroundColor: "rgba(255,255,255,0.06)" }} />

      {/* Flash overlay */}
      <Animated.View
        style={[{ position: "absolute", inset: 0, backgroundColor: "#FFFFFF", zIndex: 50, pointerEvents: "none" }, flashStyle]}
      />

      {/* Back button */}
      <View style={{ position: "absolute", top: insets.top + 14, left: 20, zIndex: 60 }}>
        <PressableScale onPress={confirmBack} hapticType="light"
          className="w-9 h-9 rounded-full bg-black/20 items-center justify-center">
          <ArrowLeft size={18} color="#FFFFFF" />
        </PressableScale>
      </View>

      {/* WOD badge + exercise name */}
      <View className="absolute items-center"
        style={{ top: insets.top + 14, left: 60, right: 60, zIndex: 60 }}>
        <View className="bg-black/20 rounded-full px-4 py-1 mb-1">
          <Text className="text-white font-bold text-xs tracking-widest">{wodLabel[wodType]}</Text>
        </View>
        <Text className="text-white/90 font-semibold text-sm text-center" numberOfLines={1}>
          {exerciseName}
        </Text>
      </View>

      {/* Center: clock + controls */}
      <View className="flex-1 items-center justify-center" style={{ paddingTop: insets.top + 90 }}>

        {/* Phase label */}
        {display.phase && (
          <Animated.View key={display.phase} entering={FadeIn.duration(180)} className="mb-3">
            {wodType === "TABATA" && display.isWork !== null ? (
              <Text
                className="font-black text-3xl tracking-widest text-center"
                style={{ color: display.isWork ? "#FCA5A5" : "#6EE7B7" }}
              >
                {display.isWork ? t("wod.work") : t("wod.rest")}
              </Text>
            ) : (
              <Text className="text-white/80 font-semibold text-lg text-center">
                {display.phase}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Big clock */}
        <Text
          className="font-black text-center"
          style={{
            fontSize: 92,
            lineHeight: 96,
            color: finished ? "#6EE7B7" : isWarning ? "#FCA5A5" : "#FFFFFF",
            fontVariant: ["tabular-nums"] as any,
            textShadowColor: "rgba(0,0,0,0.25)",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 8,
          }}
        >
          {finished ? "✓" : display.clock}
        </Text>

        <Text className="text-white/60 text-xs text-center mt-2 px-8">
          {finished ? t("wod.timeUp") : wodDesc[wodType]}
        </Text>

        {(wodType === "FOR_TIME" || wodType === "MIX") && sets > 0 && (
          <View className="mt-2 bg-black/20 rounded-full px-4 py-1">
            <Text className="text-white/80 text-xs font-semibold">
              {sets} {t("wod.rounds")}{reps > 0 ? ` × ${reps} reps` : ""}
            </Text>
          </View>
        )}

        {/* AMRAP round counter */}
        {wodType === "AMRAP" && (
          <Animated.View entering={FadeInDown.delay(100).duration(350)} className="mt-8 items-center">
            <Text className="text-white/60 text-[10px] tracking-widest mb-3">
              {t("wod.rounds").toUpperCase()}
            </Text>
            <Row className="items-center gap-6">
              <PressableScale
                onPress={() => { haptic.light(); setRounds((r) => Math.max(0, r - 1)); }}
                hapticType="light"
                className="w-14 h-14 rounded-full bg-black/25 border border-white/20 items-center justify-center"
              >
                <Minus size={22} color="#FFFFFF" />
              </PressableScale>
              <Text className="text-white font-black text-6xl" style={{ minWidth: 72, textAlign: "center" }}>
                {rounds}
              </Text>
              <PressableScale
                onPress={() => { haptic.light(); setRounds((r) => r + 1); }}
                hapticType="light"
                className="w-14 h-14 rounded-full bg-white/25 border border-white/30 items-center justify-center"
              >
                <Plus size={22} color="#FFFFFF" />
              </PressableScale>
            </Row>
          </Animated.View>
        )}

        {/* Progress bar */}
        {display.progress !== null && !finished && (
          <View className="mt-8 w-56 h-1.5 bg-black/25 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full bg-white/70"
              style={{ width: `${Math.min(100, display.progress * 100)}%` }}
            />
          </View>
        )}
      </View>

      {/* Bottom buttons */}
      <View style={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>

        {!finished && (
          <PressableScale
            onPress={toggleRunning}
            hapticType="medium"
            className="rounded-2xl py-4 items-center mb-3"
            style={{ backgroundColor: running ? "rgba(0,0,0,0.30)" : "rgba(255,255,255,0.95)" }}
          >
            <Row className="items-center gap-2">
              {running
                ? <Pause size={18} color="rgba(255,255,255,0.7)" />
                : <Play  size={18} color={accent} fill={accent} />}
              <Text className="font-bold text-sm" style={{ color: running ? "rgba(255,255,255,0.7)" : accent }}>
                {running ? t("wod.pause") : t("wod.resume")}
              </Text>
            </Row>
          </PressableScale>
        )}

        <PressableScale
          onPress={markDone}
          hapticType="medium"
          disabled={toggleMut.isPending}
          className="rounded-2xl py-4 items-center"
          style={{ backgroundColor: "rgba(16,185,129,0.90)", opacity: toggleMut.isPending ? 0.65 : 1 }}
        >
          <Row className="items-center gap-2">
            <CheckCircle size={18} color="#FFFFFF" />
            <Text className="text-white font-bold text-sm">
              {toggleMut.isPending ? "Saving…" : t("wod.markDone")}
            </Text>
          </Row>
        </PressableScale>

        {wodType === "AMRAP" && finished && (
          <Animated.View entering={FadeIn.duration(400)} className="mt-4 items-center">
            <Text className="text-white/70 text-xs">{t("wod.totalRounds")}</Text>
            <Text className="text-white font-black text-4xl">{rounds}</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
