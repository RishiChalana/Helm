import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { budgetApi } from "@/lib/api";

interface BudgetStatus {
  budget_id: number;
  category: string;
  limit: string;
  spent: string;
  remaining: string;
  pace_percent: number;
  projected_spend: string;
  is_over_budget: boolean;
}

export default function BudgetsScreen() {
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const budgetsRes = await budgetApi.list();
      const budgets = budgetsRes.data;
      const today = new Date();
      const currentMonth = budgets.filter(
        (b: any) => b.period_month === today.getMonth() + 1 && b.period_year === today.getFullYear()
      );
      const statusResults = await Promise.all(
        currentMonth.map((b: any) => budgetApi.status(b.id).then((r) => r.data))
      );
      setStatuses(statusResults);
    } catch {
      Alert.alert("Error", "Could not load budgets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function renderItem({ item }: { item: BudgetStatus }) {
    const fillWidth = Math.min(item.pace_percent, 100);
    const isOver = item.is_over_budget;
    const barColor = isOver ? "#FF4F6E" : item.pace_percent > 80 ? "#FFB347" : "#6C63FF";

    return (
      <View className="bg-card rounded-xl px-4 py-4 mb-3 border border-border">
        <View className="flex-row justify-between mb-2">
          <Text className="text-text-primary font-semibold text-base">{item.category}</Text>
          <Text className={isOver ? "text-danger font-semibold" : "text-text-secondary"}>
            {item.pace_percent.toFixed(0)}%
          </Text>
        </View>

        <View className="h-2 bg-surface rounded-full mb-3">
          <View
            style={{ width: `${fillWidth}%`, backgroundColor: barColor }}
            className="h-2 rounded-full"
          />
        </View>

        <View className="flex-row justify-between">
          <Text className="text-text-secondary text-sm">
            Spent <Text className="text-text-primary">₹{item.spent}</Text>
          </Text>
          <Text className="text-text-secondary text-sm">
            Limit <Text className="text-text-primary">₹{item.limit}</Text>
          </Text>
        </View>
        {parseFloat(item.projected_spend) > parseFloat(item.limit) && (
          <Text className="text-danger text-xs mt-2">
            Projected ₹{parseFloat(item.projected_spend).toFixed(0)} — over by end of month
          </Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-text-primary text-lg font-semibold">Budgets</Text>
        <TouchableOpacity
          className="bg-accent rounded-lg px-3 py-2"
          onPress={() => setShowAdd(true)}
        >
          <Text className="text-white font-medium">+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#6C63FF" />
      ) : (
        <FlatList
          data={statuses}
          keyExtractor={(s) => String(s.budget_id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="text-text-secondary text-center mt-10">
              No budgets for this month.
            </Text>
          }
        />
      )}

      <AddBudgetModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          setShowAdd(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function AddBudgetModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!category.trim() || !limit) {
      Alert.alert("Error", "Category and limit are required.");
      return;
    }
    const today = new Date();
    setLoading(true);
    try {
      await budgetApi.create({
        category: category.trim(),
        limit_amount: parseFloat(limit),
        period_month: today.getMonth() + 1,
        period_year: today.getFullYear(),
      });
      onSaved();
      setCategory("");
      setLimit("");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not save budget.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background px-6 pt-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text-primary text-xl font-bold">New Budget</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-accent text-base">Cancel</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          className="bg-card text-text-primary rounded-xl px-4 py-4 mb-4 text-base border border-border"
          placeholder="Category (e.g. Food, Rent)"
          placeholderTextColor="#8888A0"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          className="bg-card text-text-primary rounded-xl px-4 py-4 mb-6 text-base border border-border"
          placeholder="Monthly limit (₹)"
          placeholderTextColor="#8888A0"
          keyboardType="numeric"
          value={limit}
          onChangeText={setLimit}
        />

        <TouchableOpacity
          className="bg-accent rounded-xl py-4 items-center"
          onPress={save}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Create Budget</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
