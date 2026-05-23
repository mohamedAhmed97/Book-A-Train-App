import { Tabs } from "expo-router";
import { Platform, Text, View, useColorScheme } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Dumbbell, BarChart3, Users, User, type LucideIcon } from "lucide-react-native";
import { useT } from "@/lib/i18n";

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  training: Dumbbell,
  activity: BarChart3,
  friends: Users,
  profile: User,
};

export default function TabsLayout() {
  const t = useT();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";

  const tint = "#3B82F6";
  const dim = isDark ? "#475569" : "#94A3B8";
  const barBg = isDark ? "rgba(11,18,38,0.85)" : "rgba(255,255,255,0.85)";
  const borderColor = isDark ? "rgba(36,52,86,0.6)" : "rgba(203,213,225,0.7)";

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: dim,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          backgroundColor: barBg,
          borderTopWidth: 1,
          borderTopColor: borderColor,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              tint={isDark ? "dark" : "light"}
              intensity={70}
              style={{ flex: 1 }}
            />
          ) : null,
        tabBarLabel: ({ color, children }) => (
          <Text
            style={{
              color,
              fontSize: 10,
              letterSpacing: 0.4,
              fontWeight: "600",
              marginTop: 2,
            }}
          >
            {children}
          </Text>
        ),
        tabBarIcon: ({ color, focused }) => {
          const Icon = ICONS[route.name];
          if (!Icon) return null;
          return (
            <View
              style={{
                width: 38,
                height: 32,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused
                  ? isDark ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.12)"
                  : "transparent",
              }}
            >
              <Icon size={20} color={color} strokeWidth={focused ? 2.6 : 2} />
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
