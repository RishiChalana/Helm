import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { authApi } from "@/lib/api";
import { saveTokens } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { T, F } from "@/lib/design";

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
      const detail = err.response?.data?.detail;
      Alert.alert("Registration failed", Array.isArray(detail) ? detail.map((d: any) => d.msg ?? d).join(", ") : (detail ?? "Please try again."));
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
          CREATE ACCOUNT
        </Text>

        <TextInput
          style={inputStyle}
          placeholder="Full name"
          placeholderTextColor={T.textDim}
          value={fullName}
          onChangeText={setFullName}
        />
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
          placeholder="Password (8+ characters)"
          placeholderTextColor={T.textDim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleRegister}
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
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={T.textInverse} />
          ) : (
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textInverse }}>
              CREATE ACCOUNT
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: T.textSecondary, textAlign: "center" }}>
            Already have an account?{" "}
            <Text style={{ fontFamily: F.sansMedium, fontSize: 14, lineHeight: 20, color: T.emerald }}>
              Sign in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
