import { ScrollView, View, Text, TextInput, Alert, RefreshControl, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, Check, X, ArrowRight } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";
import { PressableScale } from "@/components/ui/pressable-scale";
import { haptic } from "@/lib/haptics";

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };
const AVATAR_GRADIENTS = [
  ["#3B82F6", "#1565C0"],
  ["#14B8A6", "#0F766E"],
  ["#F59E0B", "#F43F5E"],
  ["#7C3AED", "#3B82F6"],
  ["#F43F5E", "#7C3AED"],
];

function gradientForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

import { LinearGradient } from "expo-linear-gradient";

function Avatar({ name }: { name: string }) {
  const colors = gradientForName(name) ?? AVATAR_GRADIENTS[0]!;
  return (
    <LinearGradient
      colors={colors as unknown as readonly [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
    >
      <Text className="text-white font-bold text-base">{name.charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}

export default function FriendsScreen() {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];
  const utils = trpc.useUtils();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  const { data: friends } = trpc.friends.list.useQuery();
  const { data: pending } = trpc.friends.pending.useQuery();
  const { data: feed } = trpc.friends.feed.useQuery();

  const respond = trpc.friends.respond.useMutation({
    onSuccess: () => {
      utils.friends.list.invalidate();
      utils.friends.pending.invalidate();
      utils.friends.feed.invalidate();
      haptic.success();
    },
    onError: (e: any) => Alert.alert(t("friends.couldntUpdate"), e.message),
  });

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      utils.friends.list.invalidate(),
      utils.friends.pending.invalidate(),
      utils.friends.feed.invalidate(),
    ]),
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
        <Text className="text-txt3 text-[11px] tracking-widest font-bold mb-1">
          {t("friends.title").toUpperCase()}
        </Text>
        <Text className="text-txt font-bold text-3xl mb-5">{t("friends.title")}</Text>

        {/* Search */}
        <Row className="items-center gap-2.5 bg-bg2 border border-bg5 rounded-2xl px-4 py-3 mb-5">
          <Search size={16} color={scheme === "dark" ? "#475569" : "#94A3B8"} />
          <TextInput
            className="flex-1 text-txt text-sm"
            placeholder={t("friends.searchPlaceholder")}
            placeholderTextColor={scheme === "dark" ? "#475569" : "#94A3B8"}
          />
        </Row>

        {/* Pending requests */}
        {(pending?.length ?? 0) > 0 && (
          <>
            <Text className="text-txt2 text-[10px] tracking-widest font-bold mb-2.5 text-start">
              {t("friends.pendingRequests").toUpperCase()}
            </Text>
            <View className="gap-2.5 mb-6">
              {pending?.map((f: any, i: number) => (
                <Animated.View key={f.id} entering={FadeInUp.delay(i * 40).duration(350)}>
                  <Row className="items-center gap-3 bg-bg2 border border-bg5 rounded-2xl p-3.5">
                    <Avatar name={f.requester.name} />
                    <View className="flex-1">
                      <Text className="text-txt text-sm font-bold text-start">{f.requester.name}</Text>
                      <Text className="text-txt3 text-xs text-start">{f.requester.role}</Text>
                    </View>
                    <PressableScale
                      onPress={() => respond.mutate({ friendshipId: f.id, accept: true })}
                      hapticType="medium"
                      className="w-9 h-9 rounded-full bg-accent items-center justify-center"
                    >
                      <Check size={16} color="#FFFFFF" strokeWidth={3} />
                    </PressableScale>
                    <PressableScale
                      onPress={() => respond.mutate({ friendshipId: f.id, accept: false })}
                      hapticType="light"
                      className="w-9 h-9 rounded-full bg-bg3 border border-bg5 items-center justify-center"
                    >
                      <X size={16} color={scheme === "dark" ? "#94A3B8" : "#64748B"} strokeWidth={2.5} />
                    </PressableScale>
                  </Row>
                </Animated.View>
              ))}
            </View>
          </>
        )}

        {/* Friends */}
        <Text className="text-txt2 text-[10px] tracking-widest font-bold mb-2.5 text-start">
          {t("friends.myFriendsCount", { count: friends?.length ?? 0 }).toUpperCase()}
        </Text>
        <View className="gap-2.5 mb-6">
          {friends?.length === 0 && (
            <Text className="text-txt3 text-sm text-center py-4">{t("friends.emptyFriends")}</Text>
          )}
          {friends?.map((f: any, i: number) => {
            const friend = f.requesterId === user?.id ? f.addressee : f.requester;
            return (
              <Animated.View key={f.id} entering={FadeInUp.delay(i * 40).duration(350)}>
                <PressableScale className="bg-bg2 border border-bg5 rounded-2xl p-3.5">
                  <Row className="items-center gap-3">
                    <View className="relative">
                      <Avatar name={friend.name} />
                      <View
                        className="absolute w-3 h-3 rounded-full bg-emerald border-2 border-bg2"
                        style={{ bottom: 0, end: 0 }}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-txt text-sm font-bold text-start">{friend.name}</Text>
                      <Text className="text-txt3 text-xs text-start">{friend.role}</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-primary/15 items-center justify-center">
                      <ArrowRight size={14} color="#3B82F6" />
                    </View>
                  </Row>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {/* Feed */}
        {(feed?.length ?? 0) > 0 && (
          <>
            <Text className="text-txt font-bold text-base mb-3 text-start">{t("friends.feedTitle")}</Text>
            <View className="gap-3">
              {feed?.slice(0, 10).map((item: any, i: number) => (
                <Animated.View key={item.id} entering={FadeInUp.delay(i * 40).duration(350)}>
                  <View className="bg-bg2 border border-bg5 rounded-2xl p-4">
                    <Row className="items-center gap-2.5 mb-3">
                      <Avatar name={item.booking.athlete.user.name} />
                      <View className="flex-1">
                        <Text className="text-txt text-sm font-bold text-start">
                          {item.booking.athlete.user.name}
                        </Text>
                        <Text className="text-txt3 text-[10px] text-start">
                          {item.completedAt ? new Date(item.completedAt).toLocaleDateString(tag) : ""}
                        </Text>
                      </View>
                    </Row>
                    <View className="bg-bg3 rounded-xl p-3">
                      <Text className="text-txt2 text-[10px] tracking-widest font-bold mb-1 text-start">
                        {item.booking.session.sport.toUpperCase()}
                      </Text>
                      <Text className="text-txt text-sm font-bold text-start">
                        {item.booking.session.title}
                      </Text>
                      <Text className="text-accent-light text-xs mt-1 font-semibold text-start">
                        {t("friends.completedExercise", { name: item.exercise.name })}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
