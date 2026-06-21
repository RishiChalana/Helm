import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { statementApi, type ApprovedCandidate } from "@/lib/api";
import {
  getCandidates,
  clearCandidates,
  type TransactionCandidate,
} from "@/lib/statementStore";

const CATEGORIES = [
  "Food",
  "Transport",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Health",
  "Housing",
  "Salary",
  "Transfer",
  "Other",
];

// Editable local copy of a candidate
interface LocalCandidate extends TransactionCandidate {
  included: boolean;
  // editable overrides
  editDate: string;
  editAmount: string;
  editCategory: string;
  editMerchant: string;
  editType: "debit" | "credit";
}

function toLocal(c: TransactionCandidate): LocalCandidate {
  return {
    ...c,
    included: true,
    editDate: c.transaction_date,
    editAmount: String(c.amount),
    editCategory: c.category,
    editMerchant: c.merchant ?? "",
    editType: c.type,
  };
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  candidate,
  onSave,
  onClose,
}: {
  candidate: LocalCandidate;
  onSave: (updates: Partial<LocalCandidate>) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(candidate.editDate);
  const [amount, setAmount] = useState(candidate.editAmount);
  const [category, setCategory] = useState(candidate.editCategory);
  const [merchant, setMerchant] = useState(candidate.editMerchant);
  const [type, setType] = useState<"debit" | "credit">(candidate.editType);

  function save() {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Validation", "Amount must be a positive number.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation", "Date must be in YYYY-MM-DD format.");
      return;
    }
    onSave({
      editDate: date,
      editAmount: String(parsedAmount),
      editCategory: category || "Other",
      editMerchant: merchant,
      editType: type,
    });
    onClose();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <ScrollView className="flex-1 bg-background px-6 pt-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text-primary text-xl font-bold">Edit Transaction</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-accent text-base">Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Type toggle */}
        <View className="flex-row mb-4" style={{ gap: 12 }}>
          {(["debit", "credit"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              className={`flex-1 rounded-xl py-3 items-center border ${
                type === t ? "bg-accent border-accent" : "bg-card border-border"
              }`}
              onPress={() => setType(t)}
            >
              <Text className={type === t ? "text-white font-semibold" : "text-text-secondary"}>
                {t === "debit" ? "Expense" : "Income"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {[
          { label: "Date (YYYY-MM-DD)", value: date, onChange: setDate },
          { label: "Amount (₹)", value: amount, onChange: setAmount, keyboard: "numeric" as const },
          { label: "Merchant", value: merchant, onChange: setMerchant },
        ].map((f) => (
          <View key={f.label} className="mb-4">
            <Text className="text-text-secondary text-xs mb-1">{f.label}</Text>
            <TextInput
              className="bg-card text-text-primary rounded-xl px-4 py-4 text-base border border-border"
              placeholderTextColor="#8888A0"
              value={f.value}
              onChangeText={f.onChange}
              keyboardType={f.keyboard}
            />
          </View>
        ))}

        {/* Category picker */}
        <Text className="text-text-secondary text-xs mb-2">Category</Text>
        <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              className={`rounded-lg px-3 py-2 border ${
                category === cat ? "bg-accent border-accent" : "bg-card border-border"
              }`}
              onPress={() => setCategory(cat)}
            >
              <Text
                className={
                  category === cat ? "text-white font-semibold text-sm" : "text-text-secondary text-sm"
                }
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity className="bg-accent rounded-xl py-4 items-center mb-10" onPress={save}>
          <Text className="text-white font-semibold text-base">Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

// ── Candidate row ─────────────────────────────────────────────────────────────

function CandidateRow({
  item,
  onToggle,
  onEdit,
}: {
  item: LocalCandidate;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const isExpense = item.editType === "debit";
  const amountNum = parseFloat(item.editAmount);

  return (
    <View
      className={`mb-3 rounded-xl border px-4 py-4 ${
        item.is_duplicate
          ? "border-yellow-500 bg-card"
          : item.included
          ? "border-border bg-card"
          : "border-border bg-surface opacity-50"
      }`}
    >
      <View className="flex-row items-start" style={{ gap: 12 }}>
        {/* Checkbox — standalone Touchable, not nested inside another */}
        <TouchableOpacity onPress={onToggle} hitSlop={12} className="mt-0.5">
          <View
            className={`w-6 h-6 rounded border-2 items-center justify-center ${
              item.included ? "bg-accent border-accent" : "border-border bg-card"
            }`}
          >
            {item.included && <Feather name="check" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row justify-between items-start">
            <Text className="text-text-primary font-medium text-sm flex-1 mr-2" numberOfLines={1}>
              {item.editMerchant || item.description}
            </Text>
            <Text
              className={`text-base font-semibold ${isExpense ? "text-danger" : "text-accent-2"}`}
            >
              {isExpense ? "-" : "+"}₹{isNaN(amountNum) ? item.editAmount : amountNum.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
            <Text className="text-text-secondary text-xs">{item.editDate}</Text>
            <View className="bg-surface rounded px-2 py-0.5">
              <Text className="text-text-secondary text-xs">{item.editCategory}</Text>
            </View>
            <View
              className={`rounded px-2 py-0.5 ${isExpense ? "bg-danger/20" : "bg-accent-2/20"}`}
            >
              <Text className={`text-xs ${isExpense ? "text-danger" : "text-accent-2"}`}>
                {isExpense ? "Expense" : "Income"}
              </Text>
            </View>
          </View>

          {item.is_duplicate && (
            <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
              <Feather name="alert-triangle" size={12} color="#EAB308" />
              <Text className="text-yellow-500 text-xs" numberOfLines={1}>
                Possible duplicate: {item.duplicate_detail}
              </Text>
            </View>
          )}
        </View>

        {/* Edit button — tap to open edit modal */}
        <TouchableOpacity onPress={onEdit} hitSlop={12} style={{ marginTop: 2 }}>
          <Feather name="edit-2" size={16} color="#8888A0" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StatementReviewScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalCandidate[]>([]);
  const [editTarget, setEditTarget] = useState<LocalCandidate | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const raw = getCandidates();
    setItems(raw.map(toLocal));
  }, []);

  function toggleItem(idx: number) {
    setItems((prev) =>
      prev.map((it) => (it.idx === idx ? { ...it, included: !it.included } : it))
    );
  }

  function applyEdit(idx: number, updates: Partial<LocalCandidate>) {
    setItems((prev) => prev.map((it) => (it.idx === idx ? { ...it, ...updates } : it)));
  }

  const selected = items.filter((it) => it.included);
  const duplicateCount = selected.filter((it) => it.is_duplicate).length;

  async function confirm() {
    if (selected.length === 0) {
      Alert.alert("Nothing selected", "Please include at least one transaction.");
      return;
    }
    setConfirming(true);
    try {
      const approved: ApprovedCandidate[] = selected.map((it) => ({
        transaction_date: it.editDate,
        merchant: it.editMerchant || null,
        amount: parseFloat(it.editAmount),
        type: it.editType,
        category: it.editCategory,
      }));
      const res = await statementApi.confirm(approved);
      clearCandidates();
      Alert.alert(
        "Import complete",
        `${res.data.created} transaction${res.data.created !== 1 ? "s" : ""} imported successfully.`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/transactions") }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not import transactions.");
    } finally {
      setConfirming(false);
    }
  }

  function goBack() {
    clearCandidates();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={goBack} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#E8E8F0" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-text-primary text-base font-semibold">Review Transactions</Text>
          <Text className="text-text-secondary text-xs">
            {items.length} found · {selected.length} selected
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            setItems((prev) => {
              const allIn = prev.every((it) => it.included);
              return prev.map((it) => ({ ...it, included: !allIn }));
            })
          }
        >
          <Text className="text-accent text-sm">
            {items.every((it) => it.included) ? "Deselect all" : "Select all"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Duplicate warning banner */}
      {duplicateCount > 0 && (
        <View className="mx-4 mt-3 rounded-xl bg-yellow-500/10 border border-yellow-500/40 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
          <Feather name="alert-triangle" size={16} color="#EAB308" />
          <Text className="text-yellow-500 text-sm flex-1">
            {duplicateCount} selected item{duplicateCount !== 1 ? "s" : ""} may already exist.
            Review before importing.
          </Text>
        </View>
      )}

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-secondary text-center px-8">
            No transactions extracted from the PDF.
          </Text>
          <TouchableOpacity className="mt-4" onPress={goBack}>
            <Text className="text-accent">Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.idx)}
          renderItem={({ item }) => (
            <CandidateRow
              item={item}
              onToggle={() => toggleItem(item.idx)}
              onEdit={() => setEditTarget(item)}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        />
      )}

      {/* Bottom confirm bar */}
      {items.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-background border-t border-border">
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${
              selected.length > 0 ? "bg-accent" : "bg-card"
            }`}
            onPress={confirm}
            disabled={confirming || selected.length === 0}
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-semibold text-base ${
                  selected.length > 0 ? "text-white" : "text-text-secondary"
                }`}
              >
                Import {selected.length} Transaction{selected.length !== 1 ? "s" : ""}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          candidate={editTarget}
          onSave={(updates) => applyEdit(editTarget.idx, updates)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </SafeAreaView>
  );
}
