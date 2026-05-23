import * as React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { gradients, type GradientName } from "@/lib/gradients";

type Props = {
  /** 0–1 */
  value: number;
  gradient?: GradientName;
  height?: number;
  className?: string;
};

export function ProgressBar({ value, gradient = "hero", height = 6, className }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const widthPct = useSharedValue(0);

  React.useEffect(() => {
    widthPct.value = withSpring(clamped * 100, { damping: 18, stiffness: 110 });
  }, [clamped]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthPct.value}%` as const,
  }));

  return (
    <View
      className={`bg-bg4 rounded-full overflow-hidden ${className ?? ""}`}
      style={{ height }}
    >
      <Animated.View style={[{ height: "100%" }, animatedStyle]}>
        <LinearGradient
          colors={gradients[gradient] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </Animated.View>
    </View>
  );
}
