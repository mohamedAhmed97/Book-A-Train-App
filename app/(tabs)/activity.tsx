import { ScrollView, View, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";

const SPORTS_EMOJI: Record<string, string> = {
  Swimming: "🏊", Running: "🏃", Football: "⚽", Cycling: "🚴", Basketball: "🏀",
};

export default function ActivityScreen() {
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: bookings } = trpc.sessions.myBookings.useQuery();

  // Fake weekly bars based on real booking count
  const bars = [
    { day: "M", h: 60 }, { day: "T", h: 90 }, { day: "W", h: 40 }, { day: "T", h: 100 },
    { day: "F", h: 70 }, { day: "S", h: 30 }, { day: "S", h: 0 },
  ];

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar style="light" />
      <View className="px-4 pt-14">
        <Text className="text-txt font-bold text-xl mb-5">Activity</Text>

        {/* Weekly chart */}
        <View className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-3">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-txt font-bold text-sm">Weekly Volume</Text>
              <Text className="text-accent-light text-xs mt-0.5">↑ Great week!</Text>
            </View>
            <Text className="text-txt3 text-xs">This week</Text>
          </View>
          {/* Bar chart */}
          <View className="flex-row items-end gap-1.5 h-20 mb-1.5">
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
          </View>
          <View className="flex-row gap-1.5">
            {bars.map((b, i) => (
              <Text key={i} className="flex-1 text-center text-txt3 text-[9px]">{b.day}</Text>
            ))}
          </View>
        </View>

        {/* Stats grid */}
        <View className="flex-row gap-2 mb-5">
          {[
            { val: stats?.totalSessions ?? 0, label: "TOTAL SESSIONS", color: "text-primary-light" },
            { val: stats?.completedExercises ?? 0, label: "EXERCISES DONE", color: "text-accent-light" },
            { val: stats?.thisWeekSessions ?? 0, label: "THIS WEEK", color: "text-amber" },
          ].map((s) => (
            <View key={s.label} className="flex-1 bg-bg2 border border-bg5 rounded-xl p-3 items-center">
              <Text className={`font-bold text-2xl ${s.color} mb-1`}>{s.val}</Text>
              <Text className="text-txt3 text-[9px] tracking-wide text-center">{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Session history */}
        <Text className="text-txt font-bold text-base mb-3">Session History</Text>
        {bookings?.length === 0 && (
          <Text className="text-txt2 text-sm text-center py-8">No sessions yet</Text>
        )}
        <View className="gap-2">
          {bookings?.map((b) => (
            <View key={b.id} className="flex-row items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
              <View className="w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: "rgba(21,101,192,0.18)" }}>
                <Text className="text-xl">{SPORTS_EMOJI[b.session.sport] ?? "🏋️"}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-txt text-sm font-medium mb-0.5">{b.session.title}</Text>
                <Text className="text-txt3 text-xs">
                  {new Date(b.session.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-primary-light font-bold text-sm">{b.session.durationMinutes}m</Text>
                <Text className="text-accent-light text-[10px]">{b.progress.filter((p) => p.completed).length}/{b.session.exercises.length} done</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
