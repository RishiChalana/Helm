import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { authApi } from "@/lib/api";
import { saveTokens } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { T, F } from "@/lib/design";

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
      const detail = err.response?.data?.detail;
      Alert.alert("Login failed", Array.isArray(detail) ? detail.map((d: any) => d.msg ?? d).join(", ") : (detail ?? "Check your credentials."));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    fontFamily: F.mono,
    fontSize: 16,
    lineHeight: 24,
    color: T.textPrimary,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.borderHi,
    marginBottom: 24,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 32 }}>
        {/* Wordmark */}
        <Text style={{ fontFamily: F.serif, fontSize: 40, lineHeight: 48, color: T.textPrimary, marginBottom: 8 }}>
          Helm
        </Text>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim, marginBottom: 48 }}>
          AI FINANCE COPILOT
        </Text>

        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={T.textDim}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={{ ...inputStyle, marginBottom: 40 }}
          placeholder="Password"
          placeholderTextColor={T.textDim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={{
            backgroundColor: T.emerald,
            borderRadius: 4,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: 20,
            opacity: loading ? 0.6 : 1,
          }}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={T.textInverse} />
          ) : (
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textInverse }}>
              SIGN IN
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: T.textSecondary, textAlign: "center" }}>
            No account?{" "}
            <Text style={{ fontFamily: F.sansMedium, fontSize: 14, lineHeight: 20, color: T.emerald }}>
              Register
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
