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
import { budgetApi } from "@/lib/api";
import { T, F, fmtINR, apiErrMsg } from "@/lib/design";

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
        budgets.map((b: any) => budgetApi.status(b.id).then((r: any) => r.data))
      );
      setStatuses(statusResults);
    } catch {
      Alert.alert("Error", "Could not load budgets.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function confirmDelete(item: BudgetStatus) {
    Alert.alert(
      "Delete Budget",
      `Delete ${item.budget.category} budget (${fmtINR(item.budget.limit_amount)} limit)?`,
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
    const pct = Math.min(item.pace_percent, 100);
    const barColor = item.is_over_budget ? T.coral : item.pace_percent > 80 ? T.gold : T.emerald;
    const isOver = item.is_over_budget;

    return (
      <TouchableOpacity
        style={{ backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.border, paddingHorizontal: 20, paddingVertical: 20 }}
        onPress={() => setEditTarget(item)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
            {item.budget.category.toUpperCase()}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: isOver ? T.coral : T.textDim }}>
              {Math.round(item.pace_percent)}%
            </Text>
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 14, color: T.coral }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Flat progress bar */}
        <View style={{ height: 1, backgroundColor: T.border, marginBottom: 12 }}>
          <View style={{ width: `${pct}%`, backgroundColor: barColor, height: 1 }} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textDim }}>
            spent{" "}
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {fmtINR(item.spent)}
            </Text>
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textDim }}>
            limit{" "}
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {fmtINR(item.budget.limit_amount)}
            </Text>
          </Text>
        </View>
        {item.projected_spend > item.budget.limit_amount && (
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.coral, marginTop: 8 }}>
            PROJECTED {fmtINR(item.projected_spend)} — OVER BY MONTH END
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
          BUDGETS
        </Text>
        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: T.emerald, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6 }}
          onPress={() => setShowAdd(true)}
        >
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald }}>
            + NEW
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={T.emerald} />
        </View>
      ) : (
        <FlatList
          data={statuses}
          keyExtractor={(s) => String(s.budget.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 64, paddingHorizontal: 32 }}>
              <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary, textAlign: "center", marginBottom: 8 }}>
                No budgets
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textSecondary, textAlign: "center" }}>
                Set a monthly limit for a spending category to track your pace.
              </Text>
            </View>
          }
        />
      )}

      <BudgetModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); load(); }}
      />
      <BudgetModal
        visible={editTarget !== null}
        budgetStatus={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); load(); }}
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
  const [limit, setLimit] = useState(budgetStatus ? String(budgetStatus.budget.limit_amount) : "");
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
    const periodStart = budgetStatus?.budget.period_start ?? `${today.getFullYear()}-${mm}-01`;

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
        setCategory(""); setLimit("");
      }
      onSaved();
    } catch (err: any) {
      Alert.alert("Error", apiErrMsg(err, "Could not save budget."));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    fontFamily: F.mono,
    fontSize: 14,
    lineHeight: 20,
    color: T.textPrimary,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: T.bg, paddingHorizontal: 24, paddingTop: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary }}>
            {isEdit ? "Edit Budget" : "New Budget"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
              CANCEL
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={inputStyle}
          placeholder="Category (e.g. Food, Rent)"
          placeholderTextColor={T.textDim}
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={{ ...inputStyle, marginBottom: 24 }}
          placeholder="Monthly limit (₹)"
          placeholderTextColor={T.textDim}
          keyboardType="numeric"
          value={limit}
          onChangeText={setLimit}
        />

        <TouchableOpacity
          style={{ backgroundColor: T.emerald, borderRadius: 4, paddingVertical: 14, alignItems: "center", opacity: loading ? 0.5 : 1 }}
          onPress={save}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={T.textInverse} />
          ) : (
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textInverse }}>
              {isEdit ? "SAVE CHANGES" : "CREATE BUDGET"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
