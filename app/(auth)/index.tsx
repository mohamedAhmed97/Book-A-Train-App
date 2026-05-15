import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/ui/row";

export default function OnboardingScreen() {
  const router = useRouter();
  const t = useT();

  return (
    <View className="flex-1 bg-bg">
      <StatusBar style="light" />

      {/* Glow effects — anchored to logical leading/trailing edges, auto-flip in RTL. */}
      <View
        className="absolute w-80 h-80 rounded-full"
        style={{ top: -80, end: -80, backgroundColor: "rgba(21,101,192,0.2)" }}
      />
      <View
        className="absolute w-64 h-64 rounded-full"
        style={{ bottom: 80, start: -60, backgroundColor: "rgba(0,137,123,0.15)" }}
      />

      {/* Logo circle */}
      <View className="absolute top-20 self-center w-48 h-48 rounded-full border border-txt3 items-center justify-center">
        <View className="w-36 h-36 rounded-full border border-txt3 items-center justify-center">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
            <Text className="text-white font-bold text-sm">{t("app.name")}</Text>
            <View className="w-8 h-0.5 bg-accent-light mt-1 rounded-full" />
          </View>
        </View>
      </View>

      {/* Bottom content */}
      <View className="absolute bottom-0 start-0 end-0 px-7 pb-10">
        {/* Badge — alignSelf: flex-start is "writing-direction start", auto-flips. */}
        <Row className="items-center gap-1.5 bg-accent/10 border border-accent-light/25 rounded-full px-3 py-1.5 mb-4 self-start">
          <Text className="text-accent-light text-xs tracking-widest">{t("onboarding.badge")}</Text>
        </Row>

        <Text className="text-txt font-bold text-4xl leading-tight mb-2 text-start">
          {t("onboarding.headlineLine1")}{"\n"}
          <Text className="text-primary-light">{t("onboarding.headlineLine2")}</Text>
        </Text>

        <Text className="text-txt2 text-sm leading-relaxed mb-7 text-start">
          {t("onboarding.subtitle")}
        </Text>

        <TouchableOpacity
          className="bg-primary rounded-2xl py-4 items-center mb-3 active:opacity-80"
          onPress={() => router.push("/(auth)/login")}
        >
          <Text className="text-white font-bold text-sm tracking-wide">{t("onboarding.getStarted")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-accent/10 border border-accent-light/25 rounded-2xl py-4 items-center active:opacity-80"
          onPress={() => router.push("/(auth)/login")}
        >
          <Text className="text-accent-light font-semibold text-sm">{t("onboarding.haveAccount")}</Text>
        </TouchableOpacity>

        {/* Dots */}
        <Row className="justify-center gap-1.5 mt-5">
          <View className="w-5 h-1.5 rounded-full bg-primary-light" />
          <View className="w-1.5 h-1.5 rounded-full bg-bg4" />
          <View className="w-1.5 h-1.5 rounded-full bg-bg4" />
        </Row>
      </View>
    </View>
  );
}
