import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from "@expo-google-fonts/geist";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "@/lib/store";
import { hasTokens, clearTokens } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { authenticateWithBiometric } from "@/lib/biometric";
import { registerForPushNotifications } from "@/lib/push";
import "./global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setUser, setUnlocked, logout } = useAuthStore();
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    SplashScreen.hideAsync();

    async function bootstrap() {
      const hasAuth = await hasTokens();
      if (!hasAuth) {
        router.replace("/(auth)/login");
        setBootstrapping(false);
        return;
      }

      const unlocked = await authenticateWithBiometric();
      if (!unlocked) {
        await clearTokens();
        logout();
        router.replace("/(auth)/login");
        setBootstrapping(false);
        return;
      }

      try {
        const res = await authApi.me();
        setUser(res.data);
        setUnlocked(true);
        await registerForPushNotifications();
        router.replace("/(tabs)/dashboard");
      } catch {
        await clearTokens();
        logout();
        router.replace("/(auth)/login");
      } finally {
        setBootstrapping(false);
      }
    }
    bootstrap();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0e1511" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0e1511" },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="statement-review" options={{ presentation: "modal" }} />
        </Stack>
        {bootstrapping && <View style={styles.bootOverlay} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0e1511",
  },
});
