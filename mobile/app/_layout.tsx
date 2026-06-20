import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "@/lib/store";
import { hasTokens, clearTokens } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { authenticateWithBiometric } from "@/lib/biometric";
import { registerForPushNotifications } from "@/lib/push";
import "./global.css";

export default function RootLayout() {
  const { isAuthenticated, isUnlocked, setUser, setUnlocked, logout } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function bootstrap() {
      const hasAuth = await hasTokens();
      if (!hasAuth) {
        router.replace("/(auth)/login");
        return;
      }

      const unlocked = await authenticateWithBiometric();
      if (!unlocked) {
        await clearTokens();
        logout();
        router.replace("/(auth)/login");
        return;
      }

      try {
        const res = await authApi.me();
        setUser(res.data);
        setUnlocked(true);
        await registerForPushNotifications();
        router.replace("/(tabs)/chat");
      } catch {
        await clearTokens();
        logout();
        router.replace("/(auth)/login");
      }
    }
    bootstrap();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0F" } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
