import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

/**
 * Configure how the OS displays a notification while the app is foregrounded.
 * Without this, foreground notifications are silent on iOS.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Ask the user for permission and return their Expo push token, or null if
 * they declined / we're on a simulator (Expo Go simulators don't actually
 * deliver pushes, but on a real device this returns a usable token).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice && Platform.OS !== "web") {
    // Sims and emulators don't get APNs/FCM tokens. Skip silently.
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3B82F6",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.["eas"]?.projectId ??
    (Constants as any).easConfig?.projectId;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data;
  } catch (err) {
    console.warn("[push] getExpoPushTokenAsync failed", err);
    return null;
  }
}

export function platformName(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}
