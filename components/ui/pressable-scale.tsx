import * as React from "react";
import { Pressable, type PressableProps, type GestureResponderEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { haptic } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "onPress"> & {
  onPress?: (e: GestureResponderEvent) => void;
  hapticType?: "light" | "medium" | "heavy" | "selection" | "none";
  scaleTo?: number;
  children?: React.ReactNode;
};

/**
 * Pressable that springs to ~96% on press-in with a haptic tap.
 * Use everywhere a button-like surface should feel tactile.
 */
export function PressableScale({
  onPress,
  hapticType = "light",
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={animatedStyle}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 380 });
        if (hapticType !== "none") haptic[hapticType]();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 320 });
        onPressOut?.(e);
      }}
      onPress={onPress}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
