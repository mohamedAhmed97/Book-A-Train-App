import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useLocale, useT } from "@/lib/i18n";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { Row } from "@/components/ui/row";

const LOCALE_TAGS: Record<string, string> = { en: "en-US", ar: "ar-EG" };

export default function FriendsScreen() {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const locale = useLocale();
  const tag = LOCALE_TAGS[locale];
  const utils = trpc.useUtils();

  const { data: friends } = trpc.friends.list.useQuery();
  const { data: pending } = trpc.friends.pending.useQuery();
  const { data: feed } = trpc.friends.feed.useQuery();

  const respond = trpc.friends.respond.useMutation({
    onSuccess: () => {
      utils.friends.list.invalidate();
      utils.friends.pending.invalidate();
      utils.friends.feed.invalidate();
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
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#42A5F5" colors={["#42A5F5"]} />}
    >
      <StatusBar style="light" />
      <View className="px-4 pt-14">
        <Text className="text-txt font-bold text-xl mb-4 text-start">{t("friends.title")}</Text>

        {/* Search bar */}
        <Row className="items-center gap-2 bg-bg2 border border-bg5 rounded-xl px-3.5 py-2.5 mb-4">
          <Text className="text-txt3">🔍</Text>
          <TextInput
            className="flex-1 text-txt text-sm"
            placeholder={t("friends.searchPlaceholder")}
            placeholderTextColor="#3D4F72"
          />
        </Row>

        {/* Pending requests */}
        {(pending?.length ?? 0) > 0 && (
          <>
            <Text className="text-txt2 text-xs tracking-widest mb-2 text-start">{t("friends.pendingRequests")}</Text>
            <View className="gap-2 mb-4">
              {pending?.map((f: any) => (
                <Row key={f.id} className="items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
                  <View className="w-10 h-10 rounded-full bg-purple items-center justify-center">
                    <Text className="text-white font-bold text-sm">
                      {f.requester.name.charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-txt text-sm font-medium text-start">{f.requester.name}</Text>
                    <Text className="text-txt3 text-xs text-start">{f.requester.role}</Text>
                  </View>
                  <TouchableOpacity
                    className="bg-accent rounded-full px-3 py-1.5"
                    onPress={() => respond.mutate({ friendshipId: f.id, accept: true })}
                  >
                    <Text className="text-white text-xs font-semibold">{t("friends.accept")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-bg4 border border-bg5 rounded-full px-3 py-1.5"
                    onPress={() => respond.mutate({ friendshipId: f.id, accept: false })}
                  >
                    <Text className="text-txt2 text-xs">{t("friends.decline")}</Text>
                  </TouchableOpacity>
                </Row>
              ))}
            </View>
          </>
        )}

        {/* Friends list */}
        <Text className="text-txt2 text-xs tracking-widest mb-2 text-start">
          {t("friends.myFriendsCount", { count: friends?.length ?? 0 })}
        </Text>
        <View className="gap-2 mb-5">
          {friends?.length === 0 && (
            <Text className="text-txt3 text-sm text-center py-4">{t("friends.emptyFriends")}</Text>
          )}
          {friends?.map((f: any) => {
            const friend = f.requesterId === user?.id ? f.addressee : f.requester;
            return (
              <Row key={f.id} className="items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
                <View className="relative">
                  <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white font-bold text-sm">{friend.name.charAt(0)}</Text>
                  </View>
                  {/* Online dot — trailing edge of avatar, auto-flips. */}
                  <View
                    className="absolute bottom-0.5 w-2.5 h-2.5 rounded-full bg-accent-light border-2 border-bg2"
                    style={{ end: 2 }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-txt text-sm font-medium text-start">{friend.name}</Text>
                  <Text className="text-txt3 text-xs text-start">{friend.role}</Text>
                </View>
                <TouchableOpacity className="bg-primary/20 border border-primary-light/25 rounded-full px-3 py-1.5">
                  <Text className="text-primary-light text-xs">{t("friends.viewProfile")}</Text>
                </TouchableOpacity>
              </Row>
            );
          })}
        </View>

        {/* Activity feed */}
        {(feed?.length ?? 0) > 0 && (
          <>
            <Text className="text-txt font-bold text-base mb-3 text-start">{t("friends.feedTitle")}</Text>
            <View className="gap-3">
              {feed?.slice(0, 10).map((item: any) => (
                <View key={item.id} className="bg-bg2 border border-bg5 rounded-2xl p-4">
                  <Row className="items-center gap-2.5 mb-3">
                    <View className="w-8 h-8 rounded-full bg-accent items-center justify-center">
                      <Text className="text-white font-bold text-xs">
                        {item.booking.athlete.user.name.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-txt text-sm font-medium text-start">{item.booking.athlete.user.name}</Text>
                      <Text className="text-txt3 text-[10px] text-start">
                        {item.completedAt ? new Date(item.completedAt).toLocaleDateString(tag) : ""}
                      </Text>
                    </View>
                  </Row>
                  <View className="bg-bg3 rounded-xl p-3">
                    <Text className="text-txt2 text-xs mb-1 text-start">{item.booking.session.sport}</Text>
                    <Text className="text-txt text-sm font-semibold text-start">{item.booking.session.title}</Text>
                    <Text className="text-accent-light text-xs mt-1 text-start">
                      {t("friends.completedExercise", { name: item.exercise.name })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
