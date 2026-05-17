import { useSyncExternalStore } from "react";
import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const localeIsRTL: Record<Locale, boolean> = {
  en: false,
  ar: true,
};

export const i18n = new I18n(
  { en, ar },
  {
    defaultLocale: DEFAULT_LOCALE,
    enableFallback: true,
    missingBehavior: "guess",
  },
);

// Arabic uses six CLDR plural categories (zero/one/two/few/many/other).
// i18n-js' default pluralizer only knows one/other, so register the proper rule.
i18n.pluralization.register("ar", (_i18n, count) => {
  const mod100 = count % 100;
  if (count === 0) return ["zero", "other"];
  if (count === 1) return ["one", "other"];
  if (count === 2) return ["two", "other"];
  if (mod100 >= 3 && mod100 <= 10) return ["few", "other"];
  if (mod100 >= 11 && mod100 <= 99) return ["many", "other"];
  return ["other"];
});

export function detectDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(code ?? "")
    ? (code as Locale)
    : DEFAULT_LOCALE;
}

// Minimal pub/sub so React re-renders when locale changes at runtime
// (e.g. before reload, or for in-memory previews on web).
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return i18n.locale;
}

export function setI18nLocale(locale: Locale) {
  if (i18n.locale === locale) return;
  i18n.locale = locale;
  listeners.forEach((cb) => cb());
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as Locale;
}

export type TranslateOptions = Record<string, string | number | undefined> & {
  count?: number;
};

export function t(scope: string, options?: TranslateOptions): string {
  return i18n.t(scope, options);
}

export function useT() {
  // Re-read on locale change so consuming components re-render.
  useLocale();
  return t;
}
