import { useState } from "react";
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, Dumbbell, Mail, Lock, User as UserIcon, Trophy } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useIsRTL } from "@/lib/rtl";
import { useT } from "@/lib/i18n";
import { useColorScheme } from "react-native";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PressableScale } from "@/components/ui/pressable-scale";
import { gradients } from "@/lib/gradients";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isRTL = useIsRTL();
  const t = useT();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#F8FAFC" : "#0F172A";
  const mutedIconColor = scheme === "dark" ? "#94A3B8" : "#64748B";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async (data: any) => { await setAuth(data.user, data.token); },
    onError: (e: any) => Alert.alert(t("common.error"), e.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async (data: any) => { await setAuth(data.user, data.token); },
    onError: (e: any) => Alert.alert(t("common.error"), e.message),
  });

  const isLoading = login.isPending || register.isPending;

  const handleSubmit = () => {
    if (mode === "login") {
      login.mutate({ email: email.trim(), password });
    } else {
      if (!name.trim()) return Alert.alert(t("common.error"), t("login.nameRequired"));
      register.mutate({ name: name.trim(), email: email.trim(), password, role: "ATHLETE", sport: sport || undefined });
    }
  };

  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <View className="flex-1 bg-bg">
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      {/* Decorative top gradient */}
      <LinearGradient
        colors={gradients.hero as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <View className="px-6">
            <PressableScale
              onPress={() => router.back()}
              className="h-10 w-10 rounded-2xl bg-white/15 border border-white/25 items-center justify-center"
            >
              <Arrow size={18} color="#FFFFFF" />
            </PressableScale>
          </View>

          {/* Brand block */}
          <Animated.View entering={FadeInDown.duration(500)} className="items-center mt-8 mb-6">
            <View className="w-14 h-14 rounded-3xl bg-white items-center justify-center mb-3" style={{ elevation: 6 }}>
              <Dumbbell size={28} color="#1565C0" />
            </View>
            <Text className="text-white font-bold text-xl tracking-wide mb-1">
              {t("app.name")}
            </Text>
            <Text className="text-white/80 text-xs tracking-wide">
              {t("app.tagline")}
            </Text>
          </Animated.View>

          {/* Card */}
          <Animated.View entering={FadeIn.delay(150).duration(500)} className="mx-5">
            <View
              className="bg-bg2 border border-bg5 rounded-3xl p-6 gap-5"
              style={{ elevation: 8 }}
            >
              {/* Mode switch */}
              <Row className="rounded-2xl border border-bg5 bg-bg3 p-1">
                {(["login", "register"] as const).map((m) => (
                  <PressableScale
                    key={m}
                    onPress={() => setMode(m)}
                    hapticType="selection"
                    className={`flex-1 rounded-xl py-2.5 items-center ${mode === m ? "bg-bg2" : ""}`}
                  >
                    <Text
                      className={`text-sm font-bold ${mode === m ? "text-txt" : "text-txt2"}`}
                    >
                      {m === "login" ? t("login.signIn") : t("login.register")}
                    </Text>
                  </PressableScale>
                ))}
              </Row>

              {/* Title */}
              <View>
                <Text className="text-txt font-bold text-2xl mb-1 text-start">
                  {mode === "login" ? t("login.welcomeBack") : t("login.createAccount")}
                </Text>
                <Text className="text-txt2 text-sm text-start">
                  {mode === "login" ? t("login.welcomeBackSubtitle") : t("login.createAccountSubtitle")}
                </Text>
              </View>

              {mode === "register" && (
                <>
                  <View className="gap-1.5">
                    <Label>{t("login.name")}</Label>
                    <InputWithIcon
                      icon={<UserIcon size={16} color={mutedIconColor} />}
                      placeholder={t("login.namePlaceholder")}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                  <View className="gap-1.5">
                    <Label>{t("login.sport")}</Label>
                    <InputWithIcon
                      icon={<Trophy size={16} color={mutedIconColor} />}
                      placeholder={t("login.sportPlaceholder")}
                      value={sport}
                      onChangeText={setSport}
                    />
                  </View>
                </>
              )}

              <View className="gap-1.5">
                <Label>{t("login.email")}</Label>
                <InputWithIcon
                  icon={<Mail size={16} color={mutedIconColor} />}
                  placeholder={t("login.emailPlaceholder")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View className="gap-1.5">
                <Label>{t("login.password")}</Label>
                <InputWithIcon
                  icon={<Lock size={16} color={mutedIconColor} />}
                  placeholder={t("login.passwordPlaceholder")}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <Button onPress={handleSubmit} loading={isLoading} size="lg">
                {mode === "login" ? t("login.signIn") : t("login.createAccountBtn")}
              </Button>

              <Text className="text-txt3 text-[10px] text-center tracking-wide">
                {t("app.demoCreds")}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InputWithIcon({
  icon,
  ...inputProps
}: { icon: React.ReactNode } & React.ComponentProps<typeof Input>) {
  return (
    <View className="relative justify-center">
      <View className="absolute z-10" style={{ start: 14 }} pointerEvents="none">
        {icon}
      </View>
      <Input {...inputProps} className="ps-10" />
    </View>
  );
}
