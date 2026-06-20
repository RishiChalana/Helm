import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { insightApi } from "@/lib/api";

interface Insight {
  id: number;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  generated_at: string;
}

export default function InsightsScreen() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await insightApi.list();
      setInsights(res.data);
    } catch {
      Alert.alert("Error", "Could not load insights.");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number) {
    try {
      await insightApi.markRead(id);
      setInsights((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_read: true } : i))
      );
    } catch {}
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function renderItem({ item }: { item: Insight }) {
    return (
      <TouchableOpacity
        className={`rounded-xl px-4 py-4 mb-3 border ${
          item.is_read ? "bg-card border-border" : "bg-card border-accent"
        }`}
        onPress={() => !item.is_read && markRead(item.id)}
        activeOpacity={0.8}
      >
        {!item.is_read && (
          <View className="w-2 h-2 rounded-full bg-accent mb-2" />
        )}
        <Text className="text-text-primary font-semibold text-sm mb-1">{item.title}</Text>
        <Text className="text-text-secondary text-sm leading-5">{item.body}</Text>
        <Text className="text-text-secondary text-xs mt-2">
          {new Date(item.generated_at).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 py-3 border-b border-border">
        <Text className="text-text-primary text-lg font-semibold">Insights</Text>
        <Text className="text-text-secondary text-xs">Proactive alerts from Helm</Text>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#6C63FF" />
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="text-text-secondary text-center mt-10">
              No insights yet. Helm will notify you when something needs your attention.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
