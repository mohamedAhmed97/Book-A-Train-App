import * as React from "react";
import { View, Text, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useIsRTL } from "@/lib/rtl";
import { PressableScale } from "./pressable-scale";
import { Row } from "./row";

type Props = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  className?: string;
};

export function ScreenHeader({ title, subtitle, back, right, className }: Props) {
  const router = useRouter();
  const isRTL = useIsRTL();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#F8FAFC" : "#0F172A";
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <Row className={`items-center justify-between mb-5 ${className ?? ""}`}>
      <Row className="items-center gap-3 flex-1">
        {back && (
          <PressableScale
            onPress={() => router.back()}
            className="w-10 h-10 rounded-2xl bg-bg2 border border-bg5 items-center justify-center"
          >
            <BackIcon size={20} color={iconColor} />
          </PressableScale>
        )}
        {(title || subtitle) && (
          <View className="flex-1">
            {subtitle && (
              <Text className="text-txt3 text-[11px] tracking-widest mb-0.5 text-start">
                {subtitle.toUpperCase()}
              </Text>
            )}
            {title && (
              <Text className="text-txt font-bold text-2xl text-start">{title}</Text>
            )}
          </View>
        )}
      </Row>
      {right}
    </Row>
  );
}
