import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import {
  detectDeviceLocale,
  localeIsRTL,
  setI18nLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import { reloadApp } from "@/lib/reload";

const STORAGE_KEY = "bat_locale";

interface LocaleStore {
  locale: Locale;
  isHydrated: boolean;
  setLocale: (next: Locale) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useLocaleStore = create<LocaleStore>((set, get) => ({
  locale: detectDeviceLocale(),
  isHydrated: false,

  /**
   * Read the persisted locale (or fall back to the device locale) and apply
   * it to i18n-js + I18nManager.
   *
   * IMPORTANT: never reload here. `I18nManager.forceRTL` doesn't persist
   * across JS reloads in Expo Go, so reloading on mismatch would loop
   * forever. The flag is set silently — it takes effect on the next full
   * cold start (or immediately when the user manually switches in settings,
   * which then triggers a one-shot reload).
   */
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const candidate = (SUPPORTED_LOCALES as readonly string[]).includes(stored ?? "")
        ? (stored as Locale)
        : detectDeviceLocale();

      setI18nLocale(candidate);

      const shouldBeRTL = localeIsRTL[candidate];
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      }

      set({ locale: candidate, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  setLocale: async (next) => {
    if (next === get().locale) return;

    await AsyncStorage.setItem(STORAGE_KEY, next);
    setI18nLocale(next);
    set({ locale: next });

    const shouldBeRTL = localeIsRTL[next];
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      await reloadApp();
    }
  },
}));
