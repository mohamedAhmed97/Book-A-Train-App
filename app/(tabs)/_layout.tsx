import { Tabs } from "expo-router";
import { Text } from "react-native";

const icons: Record<string, string> = {
  index: "🏠", training: "🏋️", activity: "📊", friends: "👥", profile: "👤",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(13,21,38,0.97)",
          borderTopColor: "rgba(255,255,255,0.07)",
          height: 66,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: "#42A5F5",
        tabBarInactiveTintColor: "#3D4F72",
        tabBarLabel: ({ color, children }) => (
          <Text style={{ color, fontSize: 9, letterSpacing: 0.3 }}>{children}</Text>
        ),
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20, opacity: color === "#42A5F5" ? 1 : 0.5 }}>
            {icons[route.name] ?? "○"}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="training" options={{ title: "Training" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
