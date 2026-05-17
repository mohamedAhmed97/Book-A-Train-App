import { ScrollView, View, Text, TouchableOpacity, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { useIsRTL } from "@/lib/rtl";
import { useT, type Locale } from "@/lib/i18n";
import { Row } from "@/components/ui/row";

const LOCALE_OPTIONS: { value: Locale; labelKey: "english" | "arabic" }[] = [
  { value: "en", labelKey: "english" },
  { value: "ar", labelKey: "arabic" },
];

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isRTL = useIsRTL(); // only used to flip the trailing chevron icon
  const t = useT();

  const { data: profile } = trpc.profile.get.useQuery();
  const { data: stats } = trpc.progress.stats.useQuery();
  const { data: notifs } = trpc.notifications.list.useQuery();

  const utils = trpc.useUtils();
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const initials = user?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "A";

  const menu = [
    { icon: "🔔", label: t("profile.menuNotifications") },
    { icon: "🏆", label: t("profile.menuAchievements") },
    { icon: "⚙️", label: t("profile.menuSettings") },
    { icon: "❓", label: t("profile.menuHelp") },
    { icon: "📄", label: t("profile.menuPrivacy") },
  ];

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar style="light" />
      <View className="px-4 pt-14">

        {/* Profile hero */}
        <View className="bg-bg2 border border-bg5 rounded-2xl p-5 mb-4 items-center">
          <View className="relative mb-3">
            <View className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: "#1565C0" }}>
              <Text className="text-white font-bold text-2xl">{initials}</Text>
            </View>
            {/* Edit pencil — trailing edge, auto-flips. */}
            <TouchableOpacity
              className="absolute bottom-0 w-6 h-6 rounded-full bg-primary items-center justify-center"
              style={{ end: 0 }}
            >
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

          {/* Stats row — border-e is logical "trailing border" and auto-flips. */}
          <Row className="w-full border-t border-bg5 pt-4">
            {[
              { val: stats?.totalSessions ?? 0, label: t("profile.statSessions") },
              { val: stats?.completedExercises ?? 0, label: t("profile.statExercises") },
              { val: stats?.thisWeekSessions ?? 0, label: t("profile.statThisWeek") },
            ].map((s, i) => {
              const isLast = i === 2;
              return (
                <View key={s.label} className={`flex-1 items-center ${isLast ? "" : "border-e border-bg5"}`}>
                  <Text className="text-txt font-bold text-lg">{s.val}</Text>
                  <Text className="text-txt3 text-[9px] tracking-wide">{s.label}</Text>
                </View>
              );
            })}
          </Row>
        </View>

        {/* Notifications */}
        {notifs && notifs.filter((n: any) => !n.read).length > 0 && (
          <View className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-4">
            <Row className="justify-between items-center mb-3">
              <Text className="text-txt font-bold text-sm">{t("profile.notificationsTitle")}</Text>
              <TouchableOpacity onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                <Text className="text-primary-light text-xs">{t("profile.markAllRead")}</Text>
              </TouchableOpacity>
            </Row>
            {notifs.filter((n: any) => !n.read).slice(0, 3).map((n: any) => (
              <Row key={n.id} className="items-start gap-3 py-3 border-t border-bg5">
                <View className="w-9 h-9 rounded-xl bg-primary/20 items-center justify-center">
                  <Text className="text-base">
                    {n.type === "SESSION_ASSIGNED" ? "📋" : n.type === "SESSION_REMINDER" ? "⏰" : "🔔"}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-txt text-sm font-medium mb-0.5 text-start">{n.title}</Text>
                  <Text className="text-txt2 text-xs leading-relaxed text-start">{n.body}</Text>
                </View>
                <View className="w-1.5 h-1.5 rounded-full bg-primary-light mt-1.5" />
              </Row>
            ))}
          </View>
        )}

        {/* Language switcher */}
        <View className="bg-bg2 border border-bg5 rounded-2xl p-4 mb-4">
          <Row className="items-start gap-3 mb-3">
            <View className="w-9 h-9 rounded-xl bg-bg3 items-center justify-center">
              <Text className="text-base">🌐</Text>
            </View>
            <View className="flex-1">
              <Text className="text-txt text-sm font-medium text-start">{t("profile.languageTitle")}</Text>
              <Text className="text-txt2 text-xs leading-relaxed mt-0.5 text-start">
                {t("profile.languageDesc")}
              </Text>
            </View>
          </Row>
          <Row className="rounded-md border border-bg5 bg-bg3 p-1">
            {LOCALE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setLocale(opt.value)}
                className={`flex-1 rounded-sm py-2 items-center ${locale === opt.value ? "bg-bg2" : ""}`}
                activeOpacity={0.7}
              >
                <Text className={`text-xs font-medium ${locale === opt.value ? "text-txt" : "text-txt2"}`}>
                  {t(`profile.${opt.labelKey}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </Row>
          <Text className="text-txt3 text-[10px] mt-2 text-start">
            {t("profile.rtlReloadHint")}
          </Text>
        </View>

        {/* Menu */}
        <View className="bg-bg2 border border-bg5 rounded-2xl px-4 mb-4">
          {menu.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              className={`${i < menu.length - 1 ? "border-b border-bg5" : ""}`}
              activeOpacity={0.7}
            >
              <Row className="items-center gap-3 py-3.5">
                <View className="w-9 h-9 rounded-xl bg-bg3 items-center justify-center">
                  <Text className="text-base">{item.icon}</Text>
                </View>
                <Text className="flex-1 text-txt text-sm text-start">{item.label}</Text>
                {/* Directional chevron — content, not layout. */}
                <Text className="text-txt3 text-xs">{isRTL ? "‹" : "›"}</Text>
              </Row>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          className="bg-coral/10 border border-coral/25 rounded-2xl py-4 items-center"
          onPress={() => Alert.alert(t("profile.signOutTitle"), t("profile.signOutConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.signOut"), style: "destructive", onPress: () => clearAuth() },
          ])}
          activeOpacity={0.8}
        >
          <Text className="text-coral font-semibold text-sm">{t("common.signOut")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
