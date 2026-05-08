import { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function TrainingScreen() {
  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.sessions.today.useQuery();
  const toggleProgress = trpc.progress.toggle.useMutation({
    onSuccess: () => utils.sessions.today.invalidate(),
  });

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
        <Text className="text-txt font-bold text-xl mb-2">Rest Day!</Text>
        <Text className="text-txt2 text-sm text-center leading-relaxed">No session scheduled for today. Recovery is part of the process.</Text>
      </View>
    );
  }

  const exercises = today.session.exercises;
  const progressMap = new Map(today.progress.map((p) => [p.exerciseId, p]));
  const doneCount = today.progress.filter((p) => p.completed).length;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const ringPct = exercises.length > 0 ? (doneCount / exercises.length) * 100 : 0;

  const toggle = (exerciseId: string, current: boolean) => {
    toggleProgress.mutate({ bookingId: today.id, exerciseId, completed: !current });
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar style="light" />
      <View className="px-4 pt-14">

        {/* Hero card */}
        <View className="bg-bg3 border border-bg5 rounded-2xl p-5 mb-5">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <Text className="text-txt2 text-xs tracking-widest mb-1">{today.session.sport.toUpperCase()}</Text>
              <Text className="text-txt font-bold text-2xl mb-1">{today.session.title}</Text>
              <Text className="text-txt2 text-xs">with {today.session.coach.user.name}</Text>
            </View>
            {/* Progress ring */}
            <View className="w-14 h-14 items-center justify-center">
              <View className="absolute inset-0 rounded-full border-4 border-bg4" />
              <View
                className="absolute inset-0 rounded-full border-4 border-accent-light"
                style={{ opacity: ringPct / 100 }}
              />
              <Text className="text-accent-light font-bold text-sm">{doneCount}</Text>
              <Text className="text-txt3 text-[8px]">done</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {[
              { icon: "⏱", label: `${today.session.durationMinutes} min` },
              { icon: "📍", label: today.session.location ?? "TBD" },
              { icon: "🕐", label: formatTime(today.session.scheduledAt) },
            ].map((chip) => (
              <View key={chip.label} className="flex-row items-center gap-1.5 bg-bg4 rounded-lg px-2.5 py-1.5">
                <Text className="text-xs">{chip.icon}</Text>
                <Text className="text-txt2 text-xs">{chip.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Exercise list */}
        <Text className="text-txt3 text-[10px] tracking-widest mb-2.5">EXERCISES</Text>

        <View className="gap-2 mb-5">
          {exercises.map((ex) => {
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
                {done && <View className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-light" />}
                <View className="flex-row items-center gap-3 p-3.5">
                  {/* Check button */}
                  <TouchableOpacity
                    className={`w-7 h-7 rounded-full border-2 items-center justify-center ${done ? "bg-accent-light border-accent-light" : "border-bg4"}`}
                    onPress={() => toggle(ex.id, done)}
                    hitSlop={10}
                  >
                    {done && <Text className="text-bg text-xs font-bold">✓</Text>}
                  </TouchableOpacity>

                  <View className="flex-1">
                    <Text className={`text-sm font-medium mb-0.5 ${done ? "line-through text-txt2" : "text-txt"}`}>{ex.name}</Text>
                    <Text className="text-txt3 text-xs">
                      {[ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} reps`, ex.durationSeconds && `${ex.durationSeconds}s`]
                        .filter(Boolean).join(" · ")}
                    </Text>
                  </View>

                  {ex.restSeconds && (
                    <Text className="text-txt2 text-xs">{ex.restSeconds}s rest</Text>
                  )}
                  <Text className="text-txt3 text-base">{isOpen ? "▲" : "▽"}</Text>
                </View>

                {isOpen && ex.notes && (
                  <View className="px-4 pb-3 border-t border-bg5">
                    <Text className="text-txt2 text-xs leading-relaxed mt-2">💡 {ex.notes}</Text>
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
        >
          <Text className={`font-bold text-sm ${allDone ? "text-bg" : "text-txt3"}`}>
            {allDone ? "🎉 Session Complete!" : `Complete All Exercises (${doneCount}/${exercises.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
