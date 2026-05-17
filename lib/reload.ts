import { DevSettings, Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Reload the JS bundle so I18nManager.forceRTL takes effect on already-laid-out screens.
 *
 * Production: `expo-updates` Updates.reloadAsync().
 * Development: fall back to DevSettings.reload() (Updates is unavailable in dev clients).
 * Web: window.location.reload().
 */
export async function reloadApp(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.location.reload();
    return;
  }

  if (__DEV__) {
    DevSettings.reload();
    return;
  }

  await Updates.reloadAsync();
}
