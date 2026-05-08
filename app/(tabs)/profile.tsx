import { ScrollView, View, Text, TouchableOpacity, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

const MENU = [
  { icon: "🔔", label: "Notifications" },
  { icon: "🏆", label: "Achievements" },
  { icon: "⚙️", label: "Settings" },
  { icon: "❓", label: "Help & Support" },
  { icon: "📄", label: "Privacy Policy" },
];

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: notifs } = trpc.notifications.list.useQuery();

  const markAllRead = trpc.notifications.markAllRead.useMutation();
  const utils = trpc.useUtils();

  const initials = user?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "A";

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar style="light" />
      <View className="px-4 pt-14">

        {/* Profile hero */}
        <View className="bg-bg2 border border-bg5 rounded-2xl p-5 mb-4 items-center">
          <View className="relative mb-3">
            <View className="w-20 h-20 rounded-full items-center justify-center"
              style={{ background: "linear-gradient(135deg,#1565C0,#00897B)", backgroundColor: "#1565C0" }}>
              <Text className="text-white font-bold text-2xl">{initials}</Text>
            </View>
            <TouchableOpacity className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-xs">✏️</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-txt font-bold text-xl mb-0.5">{user?.name}</Text>
          <Text className="text-txt2 text-sm mb-3">{user?.email}</Text>

          {/* Sport badge */}
          {profile?.athleteProfile?.sport && (
            <View className="bg-primary/20 border border-primary-light/25 rounded-full px-3 py-1 mb-4">
              <Text className="text-primary-light text-xs">{profile.athleteProfile.sport}</Text>
            </View>
          )}

          {/* Stats row */}
          <View className="flex-row w-full border-t border-bg5 pt-4">
            {[
              { val: stats?.totalSessions ?? 0, label: "SESSIONS" },
              { val: stats?.completedExercises ?? 0, label: "EXERCISES" },
              { val: stats?.thisWeekSessions ?? 0, label: "THIS WEEK" },
            ].map((s, i) => (
              <View key={s.label} className={`flex-1 items-center ${i < 2 ? "border-r border-bg5" : ""}`}>
                <Text className="text-txt font-bold text-lg">{s.val}</Text>
                <Text className="text-txt3 text-[9px] tracking-wide">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Notifications */}
        {notifs && notifs.filter((n) => !n.read).length > 0 && (
          <View className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-txt font-bold text-sm">Notifications</Text>
              <TouchableOpacity onPress={() => { markAllRead.mutate(); utils.notifications.list.invalidate(); }}>
                <Text className="text-primary-light text-xs">Mark all read</Text>
              </TouchableOpacity>
            </View>
            {notifs.filter((n) => !n.read).slice(0, 3).map((n) => (
              <View key={n.id} className="flex-row items-start gap-3 py-3 border-t border-bg5">
                <View className="w-9 h-9 rounded-xl bg-primary/20 items-center justify-center">
                  <Text className="text-base">
                    {n.type === "SESSION_ASSIGNED" ? "📋" : n.type === "SESSION_REMINDER" ? "⏰" : "🔔"}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-txt text-sm font-medium mb-0.5">{n.title}</Text>
                  <Text className="text-txt2 text-xs leading-relaxed">{n.body}</Text>
                </View>
                <View className="w-1.5 h-1.5 rounded-full bg-primary-light mt-1.5" />
              </View>
            ))}
          </View>
        )}

        {/* Menu */}
        <View className="bg-bg2 border border-bg5 rounded-2xl px-4 mb-4">
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              className={`flex-row items-center gap-3 py-3.5 ${i < MENU.length - 1 ? "border-b border-bg5" : ""}`}
              activeOpacity={0.7}
            >
              <View className="w-9 h-9 rounded-xl bg-bg3 items-center justify-center">
                <Text className="text-base">{item.icon}</Text>
              </View>
              <Text className="flex-1 text-txt text-sm">{item.label}</Text>
              <Text className="text-txt3 text-xs">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          className="bg-coral/10 border border-coral/25 rounded-2xl py-4 items-center"
          onPress={() => Alert.alert("Sign Out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: () => clearAuth() },
          ])}
          activeOpacity={0.8}
        >
          <Text className="text-coral font-semibold text-sm">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
