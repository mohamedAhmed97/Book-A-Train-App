import * as React from "react";
import { View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, type GradientName } from "@/lib/gradients";
import { cn } from "@/lib/utils";

type Props = ViewProps & {
  gradient?: GradientName;
  /** [x,y] start / end, default top-left to bottom-right */
  start?: [number, number];
  end?: [number, number];
};

/**
 * Card with a gradient background. Falls back to solid card if `gradient` omitted.
 */
export function GradientCard({
  gradient = "hero",
  start = [0, 0],
  end = [1, 1],
  className,
  children,
  style,
  ...rest
}: Props) {
  return (
    <View
      className={cn("rounded-3xl overflow-hidden", className)}
      style={style}
      {...rest}
    >
      <LinearGradient
        colors={gradients[gradient] as unknown as readonly [string, string, ...string[]]}
        start={{ x: start[0], y: start[1] }}
        end={{ x: end[0], y: end[1] }}
        style={{ flex: 1, padding: 20 }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
