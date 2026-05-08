import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async (data) => { await setAuth(data.user, data.token); },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async (data) => { await setAuth(data.user, data.token); },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const isLoading = login.isPending || register.isPending;

  const handleSubmit = () => {
    if (mode === "login") {
      login.mutate({ email: email.trim(), password });
    } else {
      if (!name.trim()) return Alert.alert("Error", "Name is required");
      register.mutate({ name: name.trim(), email: email.trim(), password, role: "ATHLETE", sport: sport || undefined });
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <StatusBar style="light" />
      <View className="flex-1 px-7 pt-16 pb-10">

        {/* Back */}
        <TouchableOpacity
          className="w-9 h-9 rounded-xl bg-bg3 border border-bg5 items-center justify-center mb-7"
          onPress={() => router.back()}
        >
          <Text className="text-txt text-sm">←</Text>
        </TouchableOpacity>

        {/* Tab switch */}
        <View className="flex-row bg-bg3 rounded-xl p-1 mb-7">
          {(["login", "register"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === m ? "bg-bg5" : ""}`}
              onPress={() => setMode(m)}
            >
              <Text className={`text-sm font-medium ${mode === m ? "text-txt" : "text-txt2"}`}>
                {m === "login" ? "Sign In" : "Register"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-txt font-bold text-2xl mb-1">{mode === "login" ? "Welcome back 👋" : "Create account"}</Text>
        <Text className="text-txt2 text-sm mb-7">{mode === "login" ? "Sign in to see today's training" : "Start your training journey"}</Text>

        {mode === "register" && (
          <>
            <Text className="text-txt2 text-xs tracking-widest mb-1.5">NAME</Text>
            <TextInput
              className="bg-bg3 border border-bg5 rounded-xl px-4 py-3.5 text-txt text-sm mb-4"
              placeholder="Ahmed Kamal"
              placeholderTextColor="#3D4F72"
              value={name}
              onChangeText={setName}
            />
            <Text className="text-txt2 text-xs tracking-widest mb-1.5">SPORT (optional)</Text>
            <TextInput
              className="bg-bg3 border border-bg5 rounded-xl px-4 py-3.5 text-txt text-sm mb-4"
              placeholder="Swimming, Running..."
              placeholderTextColor="#3D4F72"
              value={sport}
              onChangeText={setSport}
            />
          </>
        )}

        <Text className="text-txt2 text-xs tracking-widest mb-1.5">EMAIL</Text>
        <TextInput
          className="bg-bg3 border border-primary-light/30 rounded-xl px-4 py-3.5 text-txt text-sm mb-4"
          placeholder="ahmed@example.com"
          placeholderTextColor="#3D4F72"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text className="text-txt2 text-xs tracking-widest mb-1.5">PASSWORD</Text>
        <TextInput
          className="bg-bg3 border border-bg5 rounded-xl px-4 py-3.5 text-txt text-sm mb-6"
          placeholder="••••••••"
          placeholderTextColor="#3D4F72"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-sm tracking-wide">{mode === "login" ? "Sign In" : "Create Account"}</Text>}
        </TouchableOpacity>

        {/* Demo hint */}
        <Text className="text-txt3 text-xs text-center mt-6">
          Demo: ahmed@bat.dev / password123
        </Text>
      </View>
    </ScrollView>
  );
}
