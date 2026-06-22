import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { insightApi } from "@/lib/api";
import { T, F } from "@/lib/design";

interface Insight {
  id: number;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  generated_at: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
      setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
    } catch {}
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function renderItem({ item }: { item: Insight }) {
    return (
      <TouchableOpacity
        style={{
          backgroundColor: T.card,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderLeftWidth: item.is_read ? 0 : 2,
          borderLeftColor: item.is_read ? "transparent" : T.emerald,
        }}
        onPress={() => !item.is_read && markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, flex: 1, marginRight: 8 }}>
            {item.category.toUpperCase()}
          </Text>
          {!item.is_read && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.emerald, marginTop: 2 }} />
          )}
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary, marginBottom: 8 }}>
          {item.title}
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 22, color: T.textSecondary, marginBottom: 8 }}>
          {item.body}
        </Text>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
          {fmtDate(item.generated_at)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
          INSIGHTS
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: T.textSecondary, marginTop: 4 }}>
          Proactive alerts from Helm
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={T.emerald} />
        </View>
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 64, paddingHorizontal: 32 }}>
              <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary, textAlign: "center", marginBottom: 8 }}>
                All clear
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textSecondary, textAlign: "center" }}>
                Helm will surface insights here when your spending patterns need attention.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
