import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { Home, Dumbbell, BarChart3, Users, User, type LucideIcon } from "lucide-react-native";
import { useT } from "@/lib/i18n";

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  training: Dumbbell,
  activity: BarChart3,
  friends: Users,
  profile: User,
};

const ACTIVE = "#42A5F5";
const INACTIVE = "#3D4F72";

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(13,21,38,0.97)",
          borderTopColor: "rgba(255,255,255,0.07)",
          height: 66,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabel: ({ color, children }) => (
          <Text style={{ color, fontSize: 9, letterSpacing: 0.4, fontWeight: "500" }}>{children}</Text>
        ),
        tabBarIcon: ({ color, focused }) => {
          const Icon = ICONS[route.name];
          if (!Icon) return null;
          return (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? "rgba(66,165,245,0.12)" : "transparent",
              }}
            >
              <Icon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index"    options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="training" options={{ title: t("tabs.training") }} />
      <Tabs.Screen name="activity" options={{ title: t("tabs.activity") }} />
      <Tabs.Screen name="friends"  options={{ title: t("tabs.friends") }} />
      <Tabs.Screen name="profile"  options={{ title: t("tabs.profile") }} />
    </Tabs>
  );
}
