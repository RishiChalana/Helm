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

  useEffect(() => {
    load();
  }, []);

  function renderItem({ item }: { item: Transaction }) {
    const isExpense = item.type === "expense";
    return (
      <View className="bg-card rounded-xl px-4 py-4 mb-3 border border-border">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-text-primary font-medium text-base">{item.category}</Text>
            {item.merchant && (
              <Text className="text-text-secondary text-sm mt-0.5">{item.merchant}</Text>
            )}
            <Text className="text-text-secondary text-xs mt-1">{item.transaction_date}</Text>
          </View>
          <Text
            className={`text-base font-semibold ${isExpense ? "text-danger" : "text-accent-2"}`}
          >
            {isExpense ? "-" : "+"}₹{item.amount}
          </Text>
        </View>
        {item.note && <Text className="text-text-secondary text-sm mt-2">{item.note}</Text>}
      </View>
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

      <AddTransactionModal
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

function AddTransactionModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!amount || !category.trim()) {
      Alert.alert("Error", "Amount and category are required.");
      return;
    }
    setLoading(true);
    try {
      await transactionApi.create({
        amount: parseFloat(amount),
        type,
        category: category.trim(),
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        transaction_date: new Date().toISOString().split("T")[0],
      });
      onSaved();
      setAmount("");
      setCategory("");
      setMerchant("");
      setNote("");
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
          <Text className="text-text-primary text-xl font-bold">New Transaction</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-accent text-base">Cancel</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row mb-4 gap-3">
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
          { placeholder: "Amount (₹)", value: amount, onChange: setAmount, keyboard: "numeric" as const },
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
            <Text className="text-white font-semibold text-base">Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
