import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dumbbell, Zap, ArrowRight } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { gradients } from "@/lib/gradients";

export default function OnboardingScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      <StatusBar style="light" />

      {/* Full-bleed gradient background */}
      <LinearGradient
        colors={gradients.hero as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* Decorative glow blobs */}
      <View
        className="absolute w-80 h-80 rounded-full"
        style={{ top: -100, end: -100, backgroundColor: "rgba(255,255,255,0.12)" }}
      />
      <View
        className="absolute w-72 h-72 rounded-full"
        style={{ bottom: 120, start: -80, backgroundColor: "rgba(20,184,166,0.25)" }}
      />

      <View
        className="flex-1 justify-between px-7"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }}
      >
        {/* Brand */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Row className="items-center gap-2.5">
            <View className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 items-center justify-center">
              <Dumbbell size={20} color="#FFFFFF" />
            </View>
            <Text className="text-white font-bold text-base tracking-wide">
              {t("app.name")}
            </Text>
          </Row>
        </Animated.View>

        {/* Hero copy */}
        <View className="gap-6">
          <Animated.View entering={FadeIn.delay(200).duration(600)}>
            <Row className="items-center gap-2 bg-white/15 border border-white/25 rounded-full px-3 py-1.5 self-start">
              <Zap size={11} color="#FFFFFF" fill="#FFFFFF" />
              <Text className="text-white text-[10px] tracking-widest font-semibold">
                {t("onboarding.badge")}
              </Text>
            </Row>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).duration(700)}>
            <Text
              className="text-white font-bold text-start"
              style={{ fontSize: 52, lineHeight: 56, letterSpacing: -1.5 }}
            >
              {t("onboarding.headlineLine1")}
            </Text>
            <Text
              className="font-bold text-start"
              style={{
                fontSize: 52,
                lineHeight: 56,
                letterSpacing: -1.5,
                color: "#FEF9C3",
              }}
            >
              {t("onboarding.headlineLine2")}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(500).duration(600)}>
            <Text className="text-white/85 text-base leading-relaxed text-start">
              {t("onboarding.subtitle")}
            </Text>
          </Animated.View>
        </View>

        {/* CTAs */}
        <Animated.View entering={FadeInUp.delay(600).duration(600)} className="gap-3">
          <Button
            variant="solid"
            size="lg"
            className="bg-white"
            textClassName="text-primary"
            onPress={() => router.push("/(auth)/login")}
          >
            <Row className="items-center gap-2">
              <Text className="text-primary font-bold text-base">
                {t("onboarding.getStarted")}
              </Text>
              <ArrowRight size={18} color="#1565C0" />
            </Row>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-white/40 bg-white/10"
            textClassName="text-white"
            onPress={() => router.push("/(auth)/login")}
          >
            {t("onboarding.haveAccount")}
          </Button>
        </Animated.View>
      </View>
    </View>
  );
}
