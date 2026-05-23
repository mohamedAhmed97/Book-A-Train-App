import { ScrollView, View, Text, Alert, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Trophy, Settings, HelpCircle, FileText, LogOut, Pencil, ChevronRight, Globe } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { useIsRTL } from "@/lib/rtl";
import { useT, type Locale } from "@/lib/i18n";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { haptic } from "@/lib/haptics";
import { gradients } from "@/lib/gradients";

const LOCALE_OPTIONS: { value: Locale; labelKey: "english" | "arabic" }[] = [
  { value: "en", labelKey: "english" },
  { value: "ar", labelKey: "arabic" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isRTL = useIsRTL();
  const t = useT();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const { data: profile } = trpc.profile.get.useQuery();
  const { data: stats } = trpc.progress.stats.useQuery();

  const initials = user?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "A";

  const menu = [
    {
      icon: <Bell size={18} color={isDark ? "#60A5FA" : "#3B82F6"} />,
      bg: "bg-primary/15",
      label: t("profile.menuNotifications"),
      onPress: () => router.push("/notifications" as never),
    },
    {
      icon: <Trophy size={18} color={isDark ? "#FBBF24" : "#F59E0B"} />,
      bg: "bg-amber/15",
      label: t("profile.menuAchievements"),
    },
    {
      icon: <Settings size={18} color={isDark ? "#94A3B8" : "#64748B"} />,
      bg: "bg-bg4",
      label: t("profile.menuSettings"),
    },
    {
      icon: <HelpCircle size={18} color={isDark ? "#5EEAD4" : "#14B8A6"} />,
      bg: "bg-accent/15",
      label: t("profile.menuHelp"),
    },
    {
      icon: <FileText size={18} color={isDark ? "#A78BFA" : "#7C3AED"} />,
      bg: "bg-purple/15",
      label: t("profile.menuPrivacy"),
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />

      {/* Hero */}
      <View style={{ height: 240 + insets.top }}>
        <LinearGradient
          colors={gradients.sunset as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          className="absolute w-72 h-72 rounded-full"
          style={{ top: -100, end: -90, backgroundColor: "rgba(255,255,255,0.18)" }}
        />
        <View
          className="items-center"
          style={{ paddingTop: insets.top + 28 }}
        >
          <View className="relative mb-3">
            <View className="w-24 h-24 rounded-full bg-white items-center justify-center" style={{ elevation: 8 }}>
              <Text className="text-primary font-bold text-3xl">{initials}</Text>
            </View>
            <PressableScale
              hapticType="light"
              className="absolute w-8 h-8 rounded-full bg-bg2 border-2 border-white items-center justify-center"
              style={{ bottom: 0, end: 0 }}
            >
              <Pencil size={12} color={isDark ? "#F8FAFC" : "#0F172A"} />
            </PressableScale>
          </View>
          <Text className="text-white font-bold text-xl">{user?.name}</Text>
          <Text className="text-white/85 text-sm mb-3">{user?.email}</Text>
          {profile?.athleteProfile?.sport && (
            <View className="bg-white/15 border border-white/25 rounded-full px-3 py-1">
              <Text className="text-white text-xs font-bold tracking-wide">
                {profile.athleteProfile.sport}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="px-5 -mt-6">
        {/* Stats card */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <View className="bg-bg2 border border-bg5 rounded-3xl p-5 mb-4" style={{ elevation: 4 }}>
            <Row className="justify-around">
              {[
                { val: stats?.totalSessions ?? 0, label: t("profile.statSessions"), color: "text-primary-light" },
                { val: stats?.completedExercises ?? 0, label: t("profile.statExercises"), color: "text-accent-light" },
                { val: stats?.thisWeekSessions ?? 0, label: t("profile.statThisWeek"), color: "text-amber" },
              ].map((s, i) => (
                <View key={s.label} className="items-center flex-1">
                  <Text className={`font-bold text-2xl ${s.color}`}>{s.val}</Text>
                  <Text className="text-txt3 text-[10px] tracking-wider font-semibold mt-0.5">
                    {s.label}
                  </Text>
                  {i < 2 && <View className="absolute end-0 top-1 bottom-1 w-px bg-bg5" />}
                </View>
              ))}
            </Row>
          </View>
        </Animated.View>

        {/* Language */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <View className="bg-bg2 border border-bg5 rounded-3xl p-4 mb-4">
            <Row className="items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-2xl bg-primary/15 items-center justify-center">
                <Globe size={18} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-txt text-sm font-bold text-start">{t("profile.languageTitle")}</Text>
                <Text className="text-txt3 text-xs mt-0.5 text-start" numberOfLines={2}>
                  {t("profile.languageDesc")}
                </Text>
              </View>
            </Row>
            <Row className="rounded-xl border border-bg5 bg-bg3 p-1">
              {LOCALE_OPTIONS.map((opt) => {
                const active = locale === opt.value;
                return (
                  <PressableScale
                    key={opt.value}
                    onPress={() => {
                      haptic.selection();
                      setLocale(opt.value);
                    }}
                    hapticType="none"
                    className={`flex-1 rounded-lg py-2.5 items-center ${active ? "bg-bg2" : ""}`}
                  >
                    <Text className={`text-xs font-bold ${active ? "text-txt" : "text-txt2"}`}>
                      {t(`profile.${opt.labelKey}`)}
                    </Text>
                  </PressableScale>
                );
              })}
            </Row>
          </View>
        </Animated.View>

        {/* Menu */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <View className="bg-bg2 border border-bg5 rounded-3xl overflow-hidden mb-4">
            {menu.map((item, i) => (
              <PressableScale
                key={item.label}
                onPress={item.onPress}
                hapticType="selection"
                className={i < menu.length - 1 ? "border-b border-bg5" : ""}
              >
                <Row className="items-center gap-3 px-4 py-3.5">
                  <View className={`w-10 h-10 rounded-2xl items-center justify-center ${item.bg}`}>
                    {item.icon}
                  </View>
                  <Text className="flex-1 text-txt text-sm font-semibold text-start">{item.label}</Text>
                  <ChevronRight
                    size={16}
                    color={isDark ? "#475569" : "#94A3B8"}
                    style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
                  />
                </Row>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {/* Sign out */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <PressableScale
            hapticType="medium"
            className="bg-coral/10 border border-coral/30 rounded-2xl py-4 items-center"
            onPress={() =>
              Alert.alert(t("profile.signOutTitle"), t("profile.signOutConfirm"), [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("common.signOut"),
                  style: "destructive",
                  onPress: () => {
                    haptic.warning();
                    clearAuth();
                  },
                },
              ])
            }
          >
            <Row className="items-center gap-2">
              <LogOut size={16} color={isDark ? "#F87171" : "#EF4444"} />
              <Text className="text-coral font-bold text-sm">{t("common.signOut")}</Text>
            </Row>
          </PressableScale>
        </Animated.View>
      </View>
    </ScrollView>
  );
}
