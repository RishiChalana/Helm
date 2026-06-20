import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { authApi } from "@/lib/api";
import { saveTokens } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

export default function RegisterScreen() {
  const router = useRouter();
  const { setUser, setUnlocked } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      Alert.alert("Error", "All fields required. Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(email.trim(), password, fullName.trim());
      await saveTokens(res.data.access_token, res.data.refresh_token);
      const me = await authApi.me();
      setUser(me.data);
      setUnlocked(true);
      router.replace("/(tabs)/chat");
    } catch (err: any) {
      Alert.alert("Registration failed", err.response?.data?.detail ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background justify-center px-6">
      <Text className="text-text-primary text-3xl font-bold mb-2">Create account</Text>
      <Text className="text-text-secondary text-base mb-10">Get started with Helm</Text>

      <TextInput
        className="bg-card text-text-primary rounded-xl px-4 py-4 mb-4 text-base border border-border"
        placeholder="Full name"
        placeholderTextColor="#8888A0"
        value={fullName}
        onChangeText={setFullName}
      />
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
        placeholder="Password (8+ characters)"
        placeholderTextColor="#8888A0"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        className="bg-accent rounded-xl py-4 items-center mb-4"
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Create account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text className="text-text-secondary text-center">
          Already have an account? <Text className="text-accent">Sign in</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
