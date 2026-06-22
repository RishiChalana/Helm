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
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { transactionApi, statementApi, receiptApi } from "@/lib/api";
import { setCandidates } from "@/lib/statementStore";
import { T, F, fmtINR, toUIType, toAPIType, apiErrMsg } from "@/lib/design";

interface Transaction {
  id: number;
  amount: number;
  type: "debit" | "credit";
  category: string;
  merchant: string | null;
  note: string | null;
  transaction_date: string;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await transactionApi.list();
      setTransactions(res.data.map((t: any) => ({ ...t, type: toUIType(t.type), amount: parseFloat(t.amount) })));
    } catch {
      Alert.alert("Error", "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function importPDF() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, name: asset.name ?? "statement.pdf", type: "application/pdf" } as any);

      setUploading(true);
      const res = await statementApi.upload(formData);
      const candidates = res.data.candidates as any[];
      if (candidates.length === 0) {
        Alert.alert("No transactions found", "The PDF did not contain any extractable transactions.");
        return;
      }
      setCandidates(candidates);
      router.push("/statement-review");
    } catch (err: any) {
      Alert.alert("Import failed", apiErrMsg(err, err.message ?? "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function scanReceipt() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Allow photo access to scan receipts.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("file", { uri: asset.uri, name: "receipt.jpg", type: asset.mimeType ?? "image/jpeg" } as any);

    setScanning(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SCAN_TIMEOUT")), 25_000)
      );
      const res = await Promise.race([receiptApi.upload(formData), timeout]);
      const candidates = res.data.candidates as any[];
      if (candidates.length === 0) {
        Alert.alert("Nothing found", "No transactions could be extracted from this image.");
        return;
      }
      setCandidates(candidates);
      router.push("/statement-review");
    } catch (err: any) {
      if (err.message === "SCAN_TIMEOUT") {
        Alert.alert("Scan timed out", "Couldn't read this as a receipt. Try a clearer photo or choose a different image.");
      } else {
        Alert.alert("Scan failed", apiErrMsg(err, err.message ?? "Upload failed."));
      }
    } finally {
      setScanning(false);
    }
  }

  function confirmDelete(item: Transaction) {
    Alert.alert(
      "Delete Transaction",
      `Delete ${fmtINR(item.amount)} – ${item.category}?`,
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
    const isDebit = item.type === "debit";
    return (
      <TouchableOpacity
        style={{ backgroundColor: T.card, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 1, borderBottomWidth: 1, borderBottomColor: T.border }}
        onPress={() => setEditTarget(item)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }} numberOfLines={1}>
              {item.merchant ?? item.category}
            </Text>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim, marginTop: 2 }}>
              {item.category.toUpperCase()} · {item.transaction_date}
            </Text>
            {item.note ? (
              <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: T.textDim, marginTop: 4 }} numberOfLines={1}>
                {item.note}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: isDebit ? T.coral : T.emerald }}>
              {isDebit ? "−" : "+"}{fmtINR(item.amount)}
            </Text>
            <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 14, color: T.coral }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
            ACTIVITY
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6, opacity: uploading ? 0.5 : 1 }}
              onPress={importPDF}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={T.textDim} />
              ) : (
                <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
                  IMPORT
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6, opacity: scanning ? 0.5 : 1 }}
              onPress={scanReceipt}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator size="small" color={T.textDim} />
              ) : (
                <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
                  SCAN
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: T.emerald, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6 }}
              onPress={() => setShowAdd(true)}
            >
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald }}>
                + NEW
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={T.emerald} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => String(t.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 64, paddingHorizontal: 32 }}>
              <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary, textAlign: "center", marginBottom: 8 }}>
                No transactions
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textSecondary, textAlign: "center" }}>
                Import a bank statement or add your first transaction.
              </Text>
            </View>
          }
        />
      )}

      <TransactionModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); load(); }}
      />
      <TransactionModal
        visible={editTarget !== null}
        transaction={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); load(); }}
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
  const [type, setType] = useState<"debit" | "credit">(transaction?.type ?? "debit");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmount(transaction ? String(transaction.amount) : "");
    setCategory(transaction?.category ?? "");
    setMerchant(transaction?.merchant ?? "");
    setNote(transaction?.note ?? "");
    setType(transaction?.type ?? "debit");
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
        type: toAPIType(type),
        category: category.trim(),
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        transaction_date: transaction?.transaction_date ?? new Date().toISOString().split("T")[0],
      };
      if (isEdit) {
        await transactionApi.update(transaction!.id, payload);
      } else {
        await transactionApi.create(payload);
        setAmount(""); setCategory(""); setMerchant(""); setNote(""); setType("debit");
      }
      onSaved();
    } catch (err: any) {
      Alert.alert("Error", apiErrMsg(err, "Could not save transaction."));
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
            {isEdit ? "Edit" : "New Transaction"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
              CANCEL
            </Text>
          </TouchableOpacity>
        </View>

        {/* Type toggle */}
        <View style={{ flexDirection: "row", marginBottom: 16, gap: 8 }}>
          {(["debit", "credit"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={{
                flex: 1,
                borderRadius: 4,
                paddingVertical: 10,
                alignItems: "center",
                borderWidth: 1,
                backgroundColor: type === t ? (t === "debit" ? T.coral : T.emerald) : T.card,
                borderColor: type === t ? (t === "debit" ? T.coral : T.emerald) : T.border,
              }}
              onPress={() => setType(t)}
            >
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: type === t ? T.textInverse : T.textSecondary }}>
                {t === "debit" ? "DEBIT" : "CREDIT"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={inputStyle}
          placeholder="Amount (₹)"
          placeholderTextColor={T.textDim}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <TextInput
          style={inputStyle}
          placeholder="Category"
          placeholderTextColor={T.textDim}
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={inputStyle}
          placeholder="Merchant (optional)"
          placeholderTextColor={T.textDim}
          value={merchant}
          onChangeText={setMerchant}
        />
        <TextInput
          style={{ ...inputStyle, marginBottom: 24 }}
          placeholder="Note (optional)"
          placeholderTextColor={T.textDim}
          value={note}
          onChangeText={setNote}
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
              {isEdit ? "SAVE CHANGES" : "SAVE"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
