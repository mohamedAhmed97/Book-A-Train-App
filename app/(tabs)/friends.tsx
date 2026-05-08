import { ScrollView, View, Text, TextInput, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

export default function FriendsScreen() {
  const user = useAuthStore((s) => s.user);
  const utils = trpc.useUtils();

  const { data: friends } = trpc.friends.list.useQuery();
  const { data: pending } = trpc.friends.pending.useQuery();
  const { data: feed } = trpc.friends.feed.useQuery();

  const respond = trpc.friends.respond.useMutation({
    onSuccess: () => { utils.friends.list.invalidate(); utils.friends.pending.invalidate(); },
  });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar style="light" />
      <View className="px-4 pt-14">
        <Text className="text-txt font-bold text-xl mb-4">Friends</Text>

        {/* Search bar */}
        <View className="flex-row items-center gap-2 bg-bg2 border border-bg5 rounded-xl px-3.5 py-2.5 mb-4">
          <Text className="text-txt3">🔍</Text>
          <TextInput
            className="flex-1 text-txt text-sm"
            placeholder="Search athletes..."
            placeholderTextColor="#3D4F72"
          />
        </View>

        {/* Pending requests */}
        {(pending?.length ?? 0) > 0 && (
          <>
            <Text className="text-txt2 text-xs tracking-widest mb-2">PENDING REQUESTS</Text>
            <View className="gap-2 mb-4">
              {pending?.map((f) => (
                <View key={f.id} className="flex-row items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
                  <View className="w-10 h-10 rounded-full bg-purple items-center justify-center">
                    <Text className="text-white font-bold text-sm">
                      {f.requester.name.charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-txt text-sm font-medium">{f.requester.name}</Text>
                    <Text className="text-txt3 text-xs">{f.requester.role}</Text>
                  </View>
                  <TouchableOpacity
                    className="bg-accent rounded-full px-3 py-1.5 mr-1"
                    onPress={() => respond.mutate({ friendshipId: f.id, accept: true })}
                  >
                    <Text className="text-white text-xs font-semibold">Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-bg4 border border-bg5 rounded-full px-3 py-1.5"
                    onPress={() => respond.mutate({ friendshipId: f.id, accept: false })}
                  >
                    <Text className="text-txt2 text-xs">Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Friends list */}
        <Text className="text-txt2 text-xs tracking-widest mb-2">MY FRIENDS ({friends?.length ?? 0})</Text>
        <View className="gap-2 mb-5">
          {friends?.length === 0 && (
            <Text className="text-txt3 text-sm text-center py-4">No friends yet. Search for athletes!</Text>
          )}
          {friends?.map((f) => {
            const friend = f.requesterId === user?.id ? f.addressee : f.requester;
            return (
              <View key={f.id} className="flex-row items-center gap-3 bg-bg2 border border-bg5 rounded-xl p-3.5">
                <View className="relative">
                  <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white font-bold text-sm">{friend.name.charAt(0)}</Text>
                  </View>
                  <View className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-accent-light border-2 border-bg2" />
                </View>
                <View className="flex-1">
                  <Text className="text-txt text-sm font-medium">{friend.name}</Text>
                  <Text className="text-txt3 text-xs">{friend.role}</Text>
                </View>
                <TouchableOpacity className="bg-primary/20 border border-primary-light/25 rounded-full px-3 py-1.5">
                  <Text className="text-primary-light text-xs">View</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Activity feed */}
        {(feed?.length ?? 0) > 0 && (
          <>
            <Text className="text-txt font-bold text-base mb-3">Friends' Activity</Text>
            <View className="gap-3">
              {feed?.slice(0, 10).map((item) => (
                <View key={item.id} className="bg-bg2 border border-bg5 rounded-2xl p-4">
                  <View className="flex-row items-center gap-2.5 mb-3">
                    <View className="w-8 h-8 rounded-full bg-accent items-center justify-center">
                      <Text className="text-white font-bold text-xs">
                        {item.booking.athlete.user.name.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-txt text-sm font-medium">{item.booking.athlete.user.name}</Text>
                      <Text className="text-txt3 text-[10px]">
                        {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ""}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-bg3 rounded-xl p-3">
                    <Text className="text-txt2 text-xs mb-1">{item.booking.session.sport}</Text>
                    <Text className="text-txt text-sm font-semibold">{item.booking.session.title}</Text>
                    <Text className="text-accent-light text-xs mt-1">✓ {item.exercise.name}</Text>
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
