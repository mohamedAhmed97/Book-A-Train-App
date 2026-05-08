import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning ☀️";
  if (h < 18) return "Good afternoon 👋";
  return "Good evening 🌙";
}

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: today } = trpc.sessions.today.useQuery();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: coaches } = trpc.coaches.mine.useQuery();
  const { data: bookings } = trpc.sessions.myBookings.useQuery();
  const { data: notifCount } = trpc.notifications.unreadCount.useQuery();

  const firstName = user?.name.split(" ")[0] ?? "Athlete";

  const doneCount = today?.progress.filter((p) => p.completed).length ?? 0;
  const totalCount = today?.session.exercises.length ?? 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar style="light" />
      <View className="px-4 pt-14">

        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-txt2 text-xs mb-0.5">{greet()}</Text>
            <Text className="text-txt font-bold text-xl">{firstName}</Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 rounded-xl bg-bg3 border border-bg5 items-center justify-center relative"
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text className="text-lg">🔔</Text>
            {(notifCount?.count ?? 0) > 0 && (
              <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral" />
            )}
          </TouchableOpacity>
        </View>

        {/* Today's plan card */}
        {today ? (
          <TouchableOpacity
            className="rounded-2xl p-4 mb-4 overflow-hidden"
            style={{ backgroundColor: "#0D2144", borderWidth: 1, borderColor: "rgba(66,165,245,0.18)" }}
            onPress={() => router.push("/(tabs)/training")}
            activeOpacity={0.85}
          >
            <Text className="text-primary-light text-xs tracking-widest mb-2">TODAY'S PLAN</Text>
            <Text className="text-txt font-bold text-xl mb-1">{today.session.title}</Text>
            <Text className="text-txt2 text-xs mb-3">
              {today.session.coach.user.name} · {today.session.location ?? "Location TBD"} · {formatTime(today.session.scheduledAt)}
            </Text>
            <View className="flex-row gap-3 mb-3">
              <Text className="text-txt2 text-xs">⏱ {today.session.durationMinutes} min</Text>
              <Text className="text-txt2 text-xs">🏋️ {totalCount} exercises</Text>
              <Text className="text-txt2 text-xs">🏊 {today.session.sport}</Text>
            </View>
            {/* Progress bar */}
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-txt2 text-xs">Progress</Text>
              <Text className="text-accent-light text-xs font-bold">{doneCount} / {totalCount} done</Text>
            </View>
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
            <Text className="text-txt font-semibold">No session today</Text>
            <Text className="text-txt2 text-xs mt-1">Enjoy your rest day!</Text>
          </View>
        )}

        {/* Stats */}
        <View className="flex-row gap-2 mb-5">
          {[
            { val: stats?.totalSessions ?? 0, label: "SESSIONS" },
            { val: `${stats?.thisWeekSessions ?? 0}`, label: "THIS WEEK" },
            { val: stats?.completedExercises ?? 0, label: "EXERCISES" },
          ].map((s) => (
            <View key={s.label} className="flex-1 bg-bg2 border border-bg5 rounded-xl p-3 items-center">
              <Text className="text-primary-light font-bold text-xl">{s.val}</Text>
              <Text className="text-txt3 text-[9px] tracking-wide mt-0.5">{s.label}</Text>
            </View>
          ))}
        </View>

        {/* My coaches */}
        {coaches && coaches.length > 0 && (
          <>
            <Text className="text-txt font-bold text-base mb-3">My Coaches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              <View className="flex-row gap-2.5">
                {coaches.map((ca) => (
                  <View key={ca.id} className="w-36 bg-bg2 border border-bg5 rounded-2xl p-3.5">
                    <View className="w-11 h-11 rounded-full bg-primary items-center justify-center mb-2">
                      <Text className="text-white font-bold text-sm">
                        {ca.coach.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </Text>
                    </View>
                    <Text className="text-txt font-bold text-sm mb-0.5">{ca.coach.user.name.split(" ")[0]}</Text>
                    <Text className="text-txt2 text-[10px] mb-2">{ca.coach.sport ?? "Coach"}</Text>
                    <View className="bg-accent/20 rounded-full px-2 py-0.5 self-start">
                      <Text className="text-accent-light text-[10px]">Active</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Upcoming sessions */}
        {bookings && bookings.length > 0 && (
          <>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-txt font-bold text-base">Upcoming Sessions</Text>
              <Text className="text-primary-light text-xs">All →</Text>
            </View>
            <View className="gap-2">
              {bookings.slice(0, 4).map((b) => (
                <TouchableOpacity
                  key={b.id}
                  className="flex-row items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5"
                  onPress={() => router.push("/(tabs)/training")}
                  activeOpacity={0.8}
                >
                  <View className="w-10 h-10 rounded-xl bg-primary/20 items-center justify-center">
                    <Text className="text-lg">🏋️</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-txt text-sm font-medium mb-0.5">{b.session.title}</Text>
                    <Text className="text-txt3 text-xs">
                      {new Date(b.session.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {b.session.exercises.length} exercises
                    </Text>
                  </View>
                  <View className="bg-primary/20 rounded-full px-2.5 py-1">
                    <Text className="text-primary-light text-[10px]">
                      {new Date(b.session.scheduledAt) < new Date() ? "Past" : "Upcoming"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
