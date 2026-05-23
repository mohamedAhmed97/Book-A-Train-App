import * as React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, type GradientName } from "@/lib/gradients";

type Props = {
  value: number | string;
  label: string;
  gradient?: GradientName;
  icon?: React.ReactNode;
};

/**
 * Compact stat tile with a soft gradient accent strip on top.
 */
export function StatCard({ value, label, gradient = "hero", icon }: Props) {
  return (
    <View className="flex-1 bg-bg2 border border-bg5 rounded-2xl overflow-hidden">
      <LinearGradient
        colors={gradients[gradient] as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 3, width: "100%" }}
      />
      <View className="p-3.5 items-center">
        {icon && <View className="mb-1.5">{icon}</View>}
        <Text className="text-txt font-bold text-2xl mb-0.5">{value}</Text>
        <Text className="text-txt3 text-[10px] tracking-wider text-center uppercase">
          {label}
        </Text>
      </View>
    </View>
  );
}
