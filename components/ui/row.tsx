import { View, type ViewProps } from "react-native";

/**
 * Horizontal flex container. flexDirection: "row" already auto-flips in RTL
 * when I18nManager.isRTL is true, so no manual conditional is needed —
 * setting "row-reverse" in RTL would double-flip back to LTR.
 */
export function Row({ style, ...props }: ViewProps) {
  return <View style={[{ flexDirection: "row" }, style]} {...props} />;
}
