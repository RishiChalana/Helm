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
import { transactionApi } from "@/lib/api";

interface Transaction {
  id: number;
  amount: string;
  type: "income" | "expense";
  category: string;
  merchant: string | null;
  note: string | null;
  transaction_date: string;
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await transactionApi.list();
      setTransactions(res.data);
    } catch {
      Alert.alert("Error", "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function confirmDelete(item: Transaction) {
    Alert.alert(
      "Delete Transaction",
      `Delete ₹${item.amount} – ${item.category}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await transactionApi.delete(item.id);
              load();
            } catch {
              Alert.alert("Error", "Could not delete transaction.");
            }
          },
        },
      ]
    );
  }

  function renderItem({ item }: { item: Transaction }) {
    const isExpense = item.type === "expense";
    return (
      <TouchableOpacity
        className="bg-card rounded-xl px-4 py-4 mb-3 border border-border"
        onPress={() => setEditTarget(item)}
        activeOpacity={0.7}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-text-primary font-medium text-base">{item.category}</Text>
            {item.merchant && (
              <Text className="text-text-secondary text-sm mt-0.5">{item.merchant}</Text>
            )}
            <Text className="text-text-secondary text-xs mt-1">{item.transaction_date}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Text
              className={`text-base font-semibold ${isExpense ? "text-danger" : "text-accent-2"}`}
            >
              {isExpense ? "-" : "+"}₹{item.amount}
            </Text>
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
              <Feather name="trash-2" size={18} color="#FF4F6E" />
            </TouchableOpacity>
          </View>
        </View>
        {item.note && <Text className="text-text-secondary text-sm mt-2">{item.note}</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-text-primary text-lg font-semibold">Transactions</Text>
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
          data={transactions}
          keyExtractor={(t) => String(t.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="text-text-secondary text-center mt-10">No transactions yet.</Text>
          }
        />
      )}

      <TransactionModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          setShowAdd(false);
          load();
        }}
      />
      <TransactionModal
        visible={editTarget !== null}
        transaction={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function TransactionModal({
  visible,
  transaction,
  onClose,
  onSaved,
}: {
  visible: boolean;
  transaction?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!transaction;
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(transaction?.category ?? "");
  const [merchant, setMerchant] = useState(transaction?.merchant ?? "");
  const [note, setNote] = useState(transaction?.note ?? "");
  const [type, setType] = useState<"expense" | "income">(transaction?.type ?? "expense");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmount(transaction ? String(transaction.amount) : "");
    setCategory(transaction?.category ?? "");
    setMerchant(transaction?.merchant ?? "");
    setNote(transaction?.note ?? "");
    setType(transaction?.type ?? "expense");
  }, [transaction]);

  async function save() {
    if (!amount || !category.trim()) {
      Alert.alert("Error", "Amount and category are required.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        type,
        category: category.trim(),
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        transaction_date:
          transaction?.transaction_date ?? new Date().toISOString().split("T")[0],
      };
      if (isEdit) {
        await transactionApi.update(transaction!.id, payload);
      } else {
        await transactionApi.create(payload);
        setAmount("");
        setCategory("");
        setMerchant("");
        setNote("");
        setType("expense");
      }
      onSaved();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not save transaction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background px-6 pt-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text-primary text-xl font-bold">
            {isEdit ? "Edit Transaction" : "New Transaction"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-accent text-base">Cancel</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row mb-4" style={{ gap: 12 }}>
          {(["expense", "income"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              className={`flex-1 rounded-xl py-3 items-center border ${
                type === t ? "bg-accent border-accent" : "bg-card border-border"
              }`}
              onPress={() => setType(t)}
            >
              <Text className={type === t ? "text-white font-semibold" : "text-text-secondary"}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {[
          {
            placeholder: "Amount (₹)",
            value: amount,
            onChange: setAmount,
            keyboard: "numeric" as const,
          },
          { placeholder: "Category", value: category, onChange: setCategory },
          { placeholder: "Merchant (optional)", value: merchant, onChange: setMerchant },
          { placeholder: "Note (optional)", value: note, onChange: setNote },
        ].map((field) => (
          <TextInput
            key={field.placeholder}
            className="bg-card text-text-primary rounded-xl px-4 py-4 mb-4 text-base border border-border"
            placeholder={field.placeholder}
            placeholderTextColor="#8888A0"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType={field.keyboard}
          />
        ))}

        <TouchableOpacity
          className="bg-accent rounded-xl py-4 items-center mt-2"
          onPress={save}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {isEdit ? "Save Changes" : "Save"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
