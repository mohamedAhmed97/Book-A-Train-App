import { useState } from "react";
import { View, Text, ScrollView, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight, Dumbbell } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { useIsRTL } from "@/lib/rtl";
import { useT } from "@/lib/i18n";
// useIsRTL is still needed to swap the back-arrow icon (← / →).
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isRTL = useIsRTL();
  const t = useT();

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

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
      <StatusBar style="light" />

      {/* Back button — alignSelf: flex-start = writing-direction start (auto-flips). */}
      <Pressable
        className="h-10 w-10 rounded-md border border-border bg-card items-center justify-center mb-6 active:opacity-70 self-start"
        onPress={() => router.back()}
      >
        {isRTL ? <ArrowRight size={18} color="#EDF2FF" /> : <ArrowLeft size={18} color="#EDF2FF" />}
      </Pressable>

      <Card className="shadow-lg">
        <CardHeader className="items-center">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary mb-2">
            <Dumbbell size={22} color="#FFFFFF" />
          </View>
          <CardTitle className="text-xl">{t("app.name")}</CardTitle>
          <CardDescription>{t("app.tagline")}</CardDescription>
        </CardHeader>

        <CardContent className="gap-5">
          {/* Tab switch */}
          <Row className="rounded-md border border-border bg-muted p-1">
            {(["login", "register"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                className={`flex-1 rounded-sm py-2 items-center ${mode === m ? "bg-card" : ""}`}
              >
                <Text className={`text-sm font-medium ${mode === m ? "text-foreground" : "text-muted-foreground"}`}>
                  {m === "login" ? t("login.signIn") : t("login.register")}
                </Text>
              </Pressable>
            ))}
          </Row>

          <View>
            <Text className="text-foreground font-semibold text-lg mb-1 text-start">
              {mode === "login" ? t("login.welcomeBack") : t("login.createAccount")}
            </Text>
            <Text className="text-muted-foreground text-sm text-start">
              {mode === "login" ? t("login.welcomeBackSubtitle") : t("login.createAccountSubtitle")}
            </Text>
          </View>

          {mode === "register" && (
            <>
              <View className="gap-1.5">
                <Label>{t("login.name")}</Label>
                <Input placeholder={t("login.namePlaceholder")} value={name} onChangeText={setName} />
              </View>
              <View className="gap-1.5">
                <Label>{t("login.sport")}</Label>
                <Input placeholder={t("login.sportPlaceholder")} value={sport} onChangeText={setSport} />
              </View>
            </>
          )}

          <View className="gap-1.5">
            <Label>{t("login.email")}</Label>
            <Input
              placeholder={t("login.emailPlaceholder")}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="gap-1.5">
            <Label>{t("login.password")}</Label>
            <Input placeholder={t("login.passwordPlaceholder")} secureTextEntry value={password} onChangeText={setPassword} />
          </View>

          <Button onPress={handleSubmit} loading={isLoading} size="lg">
            {mode === "login" ? t("login.signIn") : t("login.createAccountBtn")}
          </Button>

          <Text className="text-muted-foreground text-xs text-center">
            {t("app.demoCreds")}
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
