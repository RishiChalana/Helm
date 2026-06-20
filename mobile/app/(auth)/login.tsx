import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { authApi } from "@/lib/api";
import { saveTokens } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

export default function LoginScreen() {
  const router = useRouter();
  const { setUser, setUnlocked } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      await saveTokens(res.data.access_token, res.data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      setUnlocked(true);
      router.replace("/(tabs)/chat");
    } catch (err: any) {
      Alert.alert("Login failed", err.response?.data?.detail ?? "Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <Text className="text-text-primary text-3xl font-bold mb-2">Helm</Text>
      <Text className="text-text-secondary text-base mb-10">Your AI finance copilot</Text>

      <TextInput
        className="bg-card text-text-primary rounded-xl px-4 py-4 mb-4 text-base border border-border"
        placeholder="Email"
        placeholderTextColor="#8888A0"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="bg-card text-text-primary rounded-xl px-4 py-4 mb-6 text-base border border-border"
        placeholder="Password"
        placeholderTextColor="#8888A0"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        className="bg-accent rounded-xl py-4 items-center mb-4"
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Sign in</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text className="text-text-secondary text-center">
          No account? <Text className="text-accent">Register</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
