import { ScrollView, View, Text, RefreshControl, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, XCircle, Dumbbell, UserPlus, Users, Trophy, MessageCircle, Bell } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";
import { useIsRTL } from "@/lib/rtl";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { haptic } from "@/lib/haptics";

type IconMeta = { Icon: any; tint: string; bg: string };

function metaFor(type: string, isDark: boolean): IconMeta {
  const map: Record<string, IconMeta> = {
    SESSION_REMINDER:  { Icon: Calendar,       tint: isDark ? "#60A5FA" : "#3B82F6", bg: "bg-primary/15" },
    SESSION_ASSIGNED:  { Icon: CheckCircle2,   tint: isDark ? "#5EEAD4" : "#0F766E", bg: "bg-accent/15" },
    SESSION_CANCELLED: { Icon: XCircle,        tint: isDark ? "#F87171" : "#EF4444", bg: "bg-coral/15" },
    SESSION_ACCEPTED:  { Icon: CheckCircle2,   tint: isDark ? "#5EEAD4" : "#0F766E", bg: "bg-accent/15" },
    SESSION_DECLINED:  { Icon: XCircle,        tint: isDark ? "#F87171" : "#EF4444", bg: "bg-coral/15" },
    EXERCISE_ASSIGNED: { Icon: Dumbbell,       tint: isDark ? "#60A5FA" : "#3B82F6", bg: "bg-primary/15" },
    FRIEND_REQUEST:    { Icon: UserPlus,       tint: isDark ? "#FBBF24" : "#F59E0B", bg: "bg-amber/15" },
    FRIEND_ACCEPTED:   { Icon: Users,          tint: isDark ? "#60A5FA" : "#3B82F6", bg: "bg-primary/15" },
    WORKOUT_COMPLETED: { Icon: Trophy,         tint: isDark ? "#FBBF24" : "#F59E0B", bg: "bg-amber/15" },
    COACH_MESSAGE:     { Icon: MessageCircle,  tint: isDark ? "#A78BFA" : "#7C3AED", bg: "bg-purple/15" },
  };
  return map[type] ?? { Icon: Bell, tint: isDark ? "#94A3B8" : "#64748B", bg: "bg-bg3" };
}

function timeAgo(date: Date | string, t: (k: string, o?: { count?: number }) => string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("notifications.hoursAgo", { count: hrs });
  return t("notifications.daysAgo", { count: Math.floor(hrs / 24) });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const t = useT();
  const isRTL = useIsRTL();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const utils = trpc.useUtils();

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      haptic.success();
    },
  });

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      utils.notifications.list.invalidate(),
      utils.notifications.unreadCount.invalidate(),
    ]),
  );

  const unreadCount = notifications?.filter((n: { read: boolean }) => !n.read).length ?? 0;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3B82F6"
          colors={["#3B82F6"]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <View className="px-5">
        <Row className="items-center justify-between mb-5">
          <Row className="items-center gap-3 flex-1">
            <PressableScale
              onPress={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-bg2 border border-bg5 items-center justify-center"
            >
              <BackIcon size={20} color={isDark ? "#F8FAFC" : "#0F172A"} />
            </PressableScale>
            <View className="flex-1">
              <Text className="text-txt font-bold text-2xl text-start">
                {t("notifications.title")}
              </Text>
              {unreadCount > 0 && (
                <Text className="text-txt3 text-xs mt-0.5">
                  {t("notifications.unread", { count: unreadCount })}
                </Text>
              )}
            </View>
          </Row>
          {unreadCount > 0 && (
            <PressableScale
              onPress={() => markAllRead.mutate()}
              hapticType="selection"
              className="bg-primary/15 rounded-full px-3 py-1.5"
            >
              <Text className="text-primary-light text-xs font-bold">
                {t("notifications.markAllRead")}
              </Text>
            </PressableScale>
          )}
        </Row>

        {isLoading && (
          <View className="items-center py-16">
            <Text className="text-txt2 text-sm">{t("common.loading")}</Text>
          </View>
        )}

        {!isLoading && (!notifications || notifications.length === 0) && (
          <View className="items-center py-20 gap-3">
            <View className="w-20 h-20 rounded-full bg-bg3 items-center justify-center">
              <Bell size={36} color={isDark ? "#475569" : "#94A3B8"} />
            </View>
            <Text className="text-txt text-base font-bold">{t("notifications.empty")}</Text>
            <Text className="text-txt3 text-xs">{t("notifications.emptyHint")}</Text>
          </View>
        )}

        <View className="gap-2.5">
          {notifications?.map(
            (
              n: {
                id: string;
                type: string;
                title: string;
                body: string;
                read: boolean;
                createdAt: Date | string;
              },
              idx: number,
            ) => {
              const meta = metaFor(n.type, isDark);
              const { Icon } = meta;
              return (
                <Animated.View key={n.id} entering={FadeInUp.delay(idx * 30).duration(300)}>
                  <PressableScale
                    onPress={() => { if (!n.read) markRead.mutate({ id: n.id }); }}
                    hapticType={n.read ? "none" : "selection"}
                    className={`rounded-2xl border ${n.read ? "border-bg5 bg-bg2" : "border-primary/30 bg-primary/8"}`}
                  >
                    <Row className="items-start gap-3 p-3.5">
                      <View className={`w-11 h-11 rounded-2xl items-center justify-center ${meta.bg}`}>
                        <Icon size={20} color={meta.tint} />
                      </View>
                      <View className="flex-1">
                        <Row className="items-start justify-between gap-2">
                          <Text
                            className={`flex-1 text-sm leading-snug text-start ${n.read ? "text-txt2 font-medium" : "text-txt font-bold"}`}
                          >
                            {n.title}
                          </Text>
                          <Text className="text-txt3 text-[10px] mt-0.5 font-medium">
                            {timeAgo(n.createdAt, t)}
                          </Text>
                        </Row>
                        <Text className="text-txt3 text-xs leading-relaxed mt-0.5 text-start">
                          {n.body}
                        </Text>
                      </View>
                      {!n.read && (
                        <View className="w-2 h-2 rounded-full bg-primary-light mt-2" />
                      )}
                    </Row>
                  </PressableScale>
                </Animated.View>
              );
            },
          )}
        </View>
      </View>
    </ScrollView>
  );
}
