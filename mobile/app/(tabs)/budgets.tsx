import { useState, useEffect, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { budgetApi } from "@/lib/api";

interface BudgetOut {
  id: number;
  user_id: number;
  category: string;
  limit_amount: number;
  period: string;
  period_start: string | null;
  period_end: string | null;
}

interface BudgetStatus {
  budget: BudgetOut;
  spent: number;
  remaining: number;
  pace_percent: number;
  projected_spend: number;
  is_over_budget: boolean;
}

export default function BudgetsScreen() {
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetStatus | null>(null);

  async function load() {
    setLoading(true);
    try {
      const budgetsRes = await budgetApi.list();
      const budgets = budgetsRes.data;
      const statusResults = await Promise.all(
        budgets.map((b: any) => budgetApi.status(b.id).then((r) => r.data))
      );
      setStatuses(statusResults);
    } catch {
      Alert.alert("Error", "Could not load budgets.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function confirmDelete(item: BudgetStatus) {
    Alert.alert(
      "Delete Budget",
      `Delete ${item.budget.category} budget (₹${item.budget.limit_amount.toFixed(0)} limit)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await budgetApi.delete(item.budget.id);
              load();
            } catch {
              Alert.alert("Error", "Could not delete budget.");
            }
          },
        },
      ]
    );
  }

  function renderItem({ item }: { item: BudgetStatus }) {
    const fillWidth = Math.min(item.pace_percent, 100);
    const isOver = item.is_over_budget;
    const barColor = isOver ? "#FF4F6E" : item.pace_percent > 80 ? "#FFB347" : "#6C63FF";

    return (
      <TouchableOpacity
        className="bg-card rounded-xl px-4 py-4 mb-3 border border-border"
        onPress={() => setEditTarget(item)}
        activeOpacity={0.7}
      >
        <View className="flex-row justify-between mb-2">
          <Text className="text-text-primary font-semibold text-base">{item.budget.category}</Text>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Text className={isOver ? "text-danger font-semibold" : "text-text-secondary"}>
              {item.pace_percent.toFixed(0)}%
            </Text>
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
              <Feather name="trash-2" size={18} color="#FF4F6E" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-2 bg-surface rounded-full mb-3">
          <View
            style={{ width: `${fillWidth}%`, backgroundColor: barColor }}
            className="h-2 rounded-full"
          />
        </View>

        <View className="flex-row justify-between">
          <Text className="text-text-secondary text-sm">
            Spent <Text className="text-text-primary">₹{item.spent.toFixed(0)}</Text>
          </Text>
          <Text className="text-text-secondary text-sm">
            Limit <Text className="text-text-primary">₹{item.budget.limit_amount.toFixed(0)}</Text>
          </Text>
        </View>
        {item.projected_spend > item.budget.limit_amount && (
          <Text className="text-danger text-xs mt-2">
            Projected ₹{item.projected_spend.toFixed(0)} — over by end of month
          </Text>
        )}
      </TouchableOpacity>
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
          keyExtractor={(s) => String(s.budget.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="text-text-secondary text-center mt-10">
              No budgets for this month.
            </Text>
          }
        />
      )}

      <BudgetModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          setShowAdd(false);
          load();
        }}
      />
      <BudgetModal
        visible={editTarget !== null}
        budgetStatus={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function BudgetModal({
  visible,
  budgetStatus,
  onClose,
  onSaved,
}: {
  visible: boolean;
  budgetStatus?: BudgetStatus;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!budgetStatus;
  const [category, setCategory] = useState(budgetStatus?.budget.category ?? "");
  const [limit, setLimit] = useState(
    budgetStatus ? String(budgetStatus.budget.limit_amount) : ""
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCategory(budgetStatus?.budget.category ?? "");
    setLimit(budgetStatus ? String(budgetStatus.budget.limit_amount) : "");
  }, [budgetStatus]);

  async function save() {
    if (!category.trim() || !limit) {
      Alert.alert("Error", "Category and limit are required.");
      return;
    }
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const periodStart =
      budgetStatus?.budget.period_start ?? `${today.getFullYear()}-${mm}-01`;

    setLoading(true);
    try {
      if (isEdit) {
        await budgetApi.update(budgetStatus!.budget.id, {
          category: category.trim(),
          limit_amount: parseFloat(limit),
          period: budgetStatus!.budget.period,
          period_start: periodStart,
        });
      } else {
        await budgetApi.create({
          category: category.trim(),
          limit_amount: parseFloat(limit),
          period: "monthly",
          period_start: periodStart,
        });
        setCategory("");
        setLimit("");
      }
      onSaved();
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
          <Text className="text-text-primary text-xl font-bold">
            {isEdit ? "Edit Budget" : "New Budget"}
          </Text>
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
            <Text className="text-white font-semibold text-base">
              {isEdit ? "Save Changes" : "Create Budget"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
