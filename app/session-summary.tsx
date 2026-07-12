import { useState } from "react";
import { ScrollView, View, Text, TextInput, Alert, useColorScheme, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, ArrowLeft, Clock, Flame, Gauge, Timer, Waves } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";
import { useWorkoutStore } from "@/stores/workoutStore";
import { formatDuration, formatPace, GPS_SPORTS, LAP_SPORTS } from "@/lib/workoutTracker";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { PressableScale } from "@/components/ui/pressable-scale";
import { gradients } from "@/lib/gradients";
import { haptic } from "@/lib/haptics";

const SPORT_EMOJI: Record<string, string> = {
  Running: "🏃", Cycling: "🚴", Swimming: "🏊", Football: "⚽",
  Basketball: "🏀", Tennis: "🎾", Weightlifting: "🏋️", Yoga: "🧘",
};

export default function SessionSummaryScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const params = useLocalSearchParams<{
    bookingId: string;
    sessionTitle: string;
    sport: string;
    durationMs: string;
    distanceM: string;
    avgSpeedKph: string;
    avgPaceSecPerKm: string;
    calories: string;
    isLapSport: string;
    laps: string;
    notes: string;
    readonly: string;
  }>();

  const {
    bookingId,
    sessionTitle,
    sport,
    durationMs: durationMsStr,
    distanceM: distanceMStr,
    avgSpeedKph: avgSpeedStr,
    avgPaceSecPerKm: avgPaceStr,
    calories: caloriesStr,
    isLapSport,
    laps: lapsParam,
    notes: notesParam,
    readonly: readonlyParam,
  } = params;

  const isReadonly = readonlyParam === "1";

  const durationMs = Number(durationMsStr) || 0;
  const distanceM = distanceMStr ? Number(distanceMStr) : undefined;
  const avgSpeedKph = avgSpeedStr ? Number(avgSpeedStr) : undefined;
  const avgPaceSecPerKm = avgPaceStr ? Number(avgPaceStr) : undefined;
  const caloriesAuto = caloriesStr ? Number(caloriesStr) : undefined;
  const isLap = isLapSport === "1";
  const hasGps = GPS_SPORTS.has(sport ?? "") && distanceM != null && distanceM > 0;

  const [laps, setLaps] = useState(lapsParam ?? "");
  const [notes, setNotes] = useState(notesParam ?? "");
  const [calories, setCalories] = useState(caloriesAuto ? String(caloriesAuto) : "");

  const { reset } = useWorkoutStore();

  const completeWorkout = trpc.progress.complete.useMutation({
    onSuccess: () => {
      haptic.success();
      reset();
      router.replace("/(tabs)");
    },
    onError: (e: any) => Alert.alert(t("summary.saveError"), e.message),
  });

  const handleSave = () => {
    if (!bookingId) return;
    haptic.medium();
    completeWorkout.mutate({
      bookingId,
      durationMs: durationMs || 1,
      distanceM,
      avgSpeedKph,
      avgPaceSecPerKm,
      calories: calories ? Number(calories) : caloriesAuto,
      laps: laps ? Number(laps) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const lapsDistance = laps && isLap ? Number(laps) * 50 : undefined;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style="light" />

        {/* Hero */}
        <View style={{ paddingTop: insets.top + 16, paddingBottom: 32 }}>
          <LinearGradient
            colors={gradients.forest as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", inset: 0 }}
          />
          <View className="absolute w-72 h-72 rounded-full" style={{ top: -90, end: -80, backgroundColor: "rgba(255,255,255,0.12)" }} />

          {/* Back button */}
          <View style={{ position: "absolute", top: insets.top + 12, left: 20, zIndex: 10 }}>
            <PressableScale
              onPress={() => router.back()}
              hapticType="light"
              className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
            >
              <ArrowLeft size={18} color="#FFFFFF" />
            </PressableScale>
          </View>

          <Animated.View entering={FadeInUp.duration(400)} className="items-center px-6 pt-4">
            <Text className="text-6xl mb-3">{SPORT_EMOJI[sport ?? ""] ?? "🏋️"}</Text>
            <Text className="text-white/80 text-xs tracking-widest font-bold mb-1">
              {t("summary.completed").toUpperCase()}
            </Text>
            <Text className="text-white font-bold text-2xl text-center" numberOfLines={2}>
              {sessionTitle}
            </Text>
          </Animated.View>
        </View>

        <View className="px-5 -mt-6">
          {/* Main metrics card */}
          <Animated.View entering={FadeInUp.delay(80).duration(400)}>
            <View className="bg-bg2 border border-bg5 rounded-3xl p-5 mb-4" style={{ elevation: 4 }}>
              <Text className="text-txt3 text-[10px] tracking-widest font-bold mb-4">
                {t("summary.metrics").toUpperCase()}
              </Text>

              <Row className="flex-wrap gap-4">
                <MetricTile
                  icon={<Clock size={18} color="#3B82F6" />}
                  label={t("summary.duration")}
                  value={durationMs > 0 ? formatDuration(durationMs) : "--:--"}
                  bg="bg-primary/10"
                />

                {hasGps && (
                  <>
                    <MetricTile
                      icon={<Activity size={18} color="#10B981" />}
                      label={t("summary.distance")}
                      value={`${((distanceM ?? 0) / 1000).toFixed(2)} km`}
                      bg="bg-accent/10"
                    />
                    {sport === "Running" && avgPaceSecPerKm != null && (
                      <MetricTile
                        icon={<Timer size={18} color="#8B5CF6" />}
                        label={t("summary.pace")}
                        value={`${formatPace(avgPaceSecPerKm)} /km`}
                        bg="bg-purple-500/10"
                      />
                    )}
                    {sport === "Cycling" && avgSpeedKph != null && (
                      <MetricTile
                        icon={<Gauge size={18} color="#F59E0B" />}
                        label={t("summary.speed")}
                        value={`${avgSpeedKph} km/h`}
                        bg="bg-yellow-500/10"
                      />
                    )}
                  </>
                )}

                {isLap && lapsDistance != null && (
                  <MetricTile
                    icon={<Waves size={18} color="#06B6D4" />}
                    label={t("summary.distance")}
                    value={`${(lapsDistance / 1000).toFixed(2)} km`}
                    bg="bg-cyan-500/10"
                  />
                )}

                {(caloriesAuto != null || calories) && (
                  <MetricTile
                    icon={<Flame size={18} color="#EF4444" />}
                    label={t("summary.calories")}
                    value={`${calories || caloriesAuto} kcal`}
                    bg="bg-red-500/10"
                  />
                )}
              </Row>
            </View>
          </Animated.View>

          {/* Details — editable when fresh, read-only when revisiting */}
          <Animated.View entering={FadeInUp.delay(160).duration(400)}>
            <View className="bg-bg2 border border-bg5 rounded-3xl p-5 mb-4 gap-4">
              <Text className="text-txt3 text-[10px] tracking-widest font-bold">
                {t("summary.details").toUpperCase()}
              </Text>

              {isLap && (
                <View>
                  <Text className="text-txt2 text-xs mb-1.5">{t("summary.laps")}</Text>
                  {isReadonly ? (
                    <Text className="text-txt font-semibold text-sm px-1">
                      {laps || "—"}
                    </Text>
                  ) : (
                    <TextInput
                      className="bg-bg3 rounded-xl px-4 py-3 text-txt text-sm"
                      keyboardType="number-pad"
                      placeholder={t("summary.lapsPlaceholder")}
                      placeholderTextColor={scheme === "dark" ? "#475569" : "#94A3B8"}
                      value={laps}
                      onChangeText={setLaps}
                    />
                  )}
                </View>
              )}

              <View>
                <Text className="text-txt2 text-xs mb-1.5">{t("summary.calories")}</Text>
                {isReadonly ? (
                  <Text className="text-txt font-semibold text-sm px-1">
                    {calories || caloriesAuto ? `${calories || caloriesAuto} kcal` : "—"}
                  </Text>
                ) : (
                  <TextInput
                    className="bg-bg3 rounded-xl px-4 py-3 text-txt text-sm"
                    keyboardType="number-pad"
                    placeholder={caloriesAuto ? String(caloriesAuto) : t("summary.caloriesPlaceholder")}
                    placeholderTextColor={scheme === "dark" ? "#475569" : "#94A3B8"}
                    value={calories}
                    onChangeText={setCalories}
                  />
                )}
              </View>

              <View>
                <Text className="text-txt2 text-xs mb-1.5">{t("summary.notes")}</Text>
                {isReadonly ? (
                  <Text className="text-txt text-sm leading-relaxed px-1">
                    {notes || "—"}
                  </Text>
                ) : (
                  <TextInput
                    className="bg-bg3 rounded-xl px-4 py-3 text-txt text-sm"
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 72, textAlignVertical: "top" }}
                    placeholder={t("summary.notesPlaceholder")}
                    placeholderTextColor={scheme === "dark" ? "#475569" : "#94A3B8"}
                    value={notes}
                    onChangeText={setNotes}
                  />
                )}
              </View>
            </View>
          </Animated.View>

          {/* Save button — hidden in readonly mode */}
          {!isReadonly && (
            <Animated.View entering={FadeInUp.delay(240).duration(400)}>
              <Button
                variant="gradient"
                gradient="forest"
                size="lg"
                disabled={completeWorkout.isPending}
                onPress={handleSave}
              >
                <Text className="text-white font-bold text-sm">
                  {completeWorkout.isPending ? t("summary.saving") : t("summary.save")}
                </Text>
              </Button>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MetricTile({
  icon, label, value, bg,
}: {
  icon: React.ReactNode; label: string; value: string; bg: string;
}) {
  return (
    <View className="flex-1 min-w-[120px]">
      <View className={`w-10 h-10 rounded-2xl ${bg} items-center justify-center mb-2`}>
        {icon}
      </View>
      <Text className="text-txt3 text-[10px] tracking-wide mb-0.5">{label.toUpperCase()}</Text>
      <Text className="text-txt font-bold text-base">{value}</Text>
    </View>
  );
}
