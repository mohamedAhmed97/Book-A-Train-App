import { I18nManager } from "react-native";

/**
 * After a locale switch the app is reloaded, so `I18nManager.isRTL` is always
 * the source of truth for the current render — no Zustand subscription needed.
 */
export function isRTL(): boolean {
  return I18nManager.isRTL;
}

export function useIsRTL(): boolean {
  return I18nManager.isRTL;
}

export function flexRow(): "row" | "row-reverse" {
  return I18nManager.isRTL ? "row-reverse" : "row";
}

export function textAlign(): "left" | "right" {
  return I18nManager.isRTL ? "right" : "left";
}
