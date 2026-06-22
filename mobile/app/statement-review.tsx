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
import { statementApi, type ApprovedCandidate } from "@/lib/api";
import { getCandidates, clearCandidates, type TransactionCandidate } from "@/lib/statementStore";
import { T, F, fmtINR, toUIType } from "@/lib/design";

const CATEGORIES = ["Food","Transport","Entertainment","Shopping","Utilities","Health","Housing","Salary","Transfer","Other"];

interface LocalCandidate extends TransactionCandidate {
  included: boolean;
  editDate: string;
  editAmount: string;
  editCategory: string;
  editMerchant: string;
  editType: "debit" | "credit";
}

function toLocal(c: TransactionCandidate): LocalCandidate {
  return { ...c, included: true, editDate: c.transaction_date, editAmount: String(c.amount), editCategory: c.category, editMerchant: c.merchant ?? "", editType: toUIType(c.type) };
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ candidate, onSave, onClose }: { candidate: LocalCandidate; onSave: (u: Partial<LocalCandidate>) => void; onClose: () => void }) {
  const [date, setDate] = useState(candidate.editDate);
  const [amount, setAmount] = useState(candidate.editAmount);
  const [category, setCategory] = useState(candidate.editCategory);
  const [merchant, setMerchant] = useState(candidate.editMerchant);
  const [type, setType] = useState<"debit" | "credit">(candidate.editType);

  function save() {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) { Alert.alert("Validation", "Amount must be a positive number."); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert("Validation", "Date must be in YYYY-MM-DD format."); return; }
    onSave({ editDate: date, editAmount: String(n), editCategory: category || "Other", editMerchant: merchant, editType: type });
    onClose();
  }

  const inputStyle = { fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary }}>Edit</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>CANCEL</Text>
          </TouchableOpacity>
        </View>

        {/* Type toggle */}
        <View style={{ flexDirection: "row", marginBottom: 16, gap: 8 }}>
          {(["debit", "credit"] as const).map((t) => (
            <TouchableOpacity key={t} style={{ flex: 1, borderRadius: 4, paddingVertical: 10, alignItems: "center", borderWidth: 1, backgroundColor: type === t ? (t === "debit" ? T.coral : T.emerald) : T.card, borderColor: type === t ? (t === "debit" ? T.coral : T.emerald) : T.border }} onPress={() => setType(t)}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: type === t ? T.textInverse : T.textSecondary }}>
                {t === "debit" ? "DEBIT" : "CREDIT"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 6 }}>DATE (YYYY-MM-DD)</Text>
        <TextInput style={inputStyle} placeholderTextColor={T.textDim} value={date} onChangeText={setDate} />

        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 6 }}>AMOUNT (₹)</Text>
        <TextInput style={inputStyle} placeholderTextColor={T.textDim} value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 6 }}>MERCHANT</Text>
        <TextInput style={inputStyle} placeholderTextColor={T.textDim} value={merchant} onChangeText={setMerchant} />

        {/* Category picker */}
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 8 }}>CATEGORY</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24, gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} style={{ borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, backgroundColor: category === cat ? T.emerald : T.card, borderColor: category === cat ? T.emerald : T.border }} onPress={() => setCategory(cat)}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: category === cat ? T.textInverse : T.textSecondary }}>
                {cat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={{ backgroundColor: T.emerald, borderRadius: 4, paddingVertical: 14, alignItems: "center", marginBottom: 40 }} onPress={save}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textInverse }}>SAVE CHANGES</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

// ── Candidate row ─────────────────────────────────────────────────────────────

function CandidateRow({ item, onToggle, onEdit }: { item: LocalCandidate; onToggle: () => void; onEdit: () => void }) {
  const isDebit = item.editType === "debit";
  const amountNum = parseFloat(item.editAmount);

  return (
    <View style={{ marginBottom: 1, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: item.included ? T.card : T.surface, opacity: item.included ? 1 : 0.5, paddingHorizontal: 20, paddingVertical: 16, borderLeftWidth: item.is_duplicate ? 2 : 0, borderLeftColor: "#eab308" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        {/* Checkbox */}
        <TouchableOpacity onPress={onToggle} hitSlop={12}>
          <View style={{ width: 22, height: 22, borderRadius: 2, borderWidth: 1, borderColor: item.included ? T.emerald : T.border, backgroundColor: item.included ? T.emerald : T.card, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
            {item.included && <Text style={{ fontFamily: F.mono, fontSize: 12, color: T.textInverse }}>✓</Text>}
          </View>
        </TouchableOpacity>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
              {item.editMerchant || item.description}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: isDebit ? T.coral : T.emerald }}>
              {isDebit ? "−" : "+"}{isNaN(amountNum) ? item.editAmount : fmtINR(amountNum)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim }}>
              {item.editDate}
            </Text>
            <View style={{ backgroundColor: T.surface, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
                {item.editCategory.toUpperCase()}
              </Text>
            </View>
          </View>
          {item.is_duplicate && (
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: "#eab308", marginTop: 4 }} numberOfLines={1}>
              ⚠ POSSIBLE DUPLICATE: {item.duplicate_detail}
            </Text>
          )}
        </View>

        {/* Edit */}
        <TouchableOpacity onPress={onEdit} hitSlop={12}>
          <Text style={{ fontFamily: F.mono, fontSize: 14, color: T.textDim, marginTop: 2 }}>✎</Text>
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

  useEffect(() => { setItems(getCandidates().map(toLocal)); }, []);

  function toggleItem(idx: number) {
    setItems((prev) => prev.map((it) => (it.idx === idx ? { ...it, included: !it.included } : it)));
  }

  function applyEdit(idx: number, updates: Partial<LocalCandidate>) {
    setItems((prev) => prev.map((it) => (it.idx === idx ? { ...it, ...updates } : it)));
  }

  const selected = items.filter((it) => it.included);
  const duplicateCount = selected.filter((it) => it.is_duplicate).length;

  async function confirm() {
    if (selected.length === 0) { Alert.alert("Nothing selected", "Please include at least one transaction."); return; }
    setConfirming(true);
    try {
      const approved: ApprovedCandidate[] = selected.map((it) => ({ transaction_date: it.editDate, merchant: it.editMerchant || null, amount: parseFloat(it.editAmount), type: it.editType, category: it.editCategory }));
      const res = await statementApi.confirm(approved);
      clearCandidates();
      Alert.alert("Import complete", `${res.data.created} transaction${res.data.created !== 1 ? "s" : ""} imported.`, [{ text: "OK", onPress: () => router.replace("/(tabs)/transactions") }]);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      Alert.alert("Error", Array.isArray(detail) ? detail.map((d: any) => d.msg ?? d).join(", ") : (detail ?? "Could not import transactions."));
    } finally {
      setConfirming(false);
    }
  }

  function goBack() { clearCandidates(); router.back(); }

  const allSelected = items.length > 0 && items.every((it) => it.included);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <TouchableOpacity onPress={goBack} hitSlop={8}>
          <Text style={{ fontFamily: F.mono, fontSize: 18, color: T.textPrimary }}>←</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textPrimary }}>REVIEW</Text>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim, marginTop: 2 }}>
            {items.length} found · {selected.length} selected
          </Text>
        </View>
        <TouchableOpacity onPress={() => setItems((prev) => prev.map((it) => ({ ...it, included: !allSelected })))}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald }}>
            {allSelected ? "DESELECT" : "SELECT ALL"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Duplicate warning */}
      {duplicateCount > 0 && (
        <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: "#eab30820", borderWidth: 1, borderColor: "#eab30860", borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: "#eab308" }}>
            ⚠ {duplicateCount} ITEM{duplicateCount !== 1 ? "S" : ""} MAY ALREADY EXIST — REVIEW BEFORE IMPORTING
          </Text>
        </View>
      )}

      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textSecondary, textAlign: "center", marginBottom: 16 }}>
            No transactions extracted from the PDF.
          </Text>
          <TouchableOpacity onPress={goBack}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald }}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.idx)}
          renderItem={({ item }) => (
            <CandidateRow item={item} onToggle={() => toggleItem(item.idx)} onEdit={() => setEditTarget(item)} />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      {/* Bottom confirm bar */}
      {items.length > 0 && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border }}>
          <TouchableOpacity
            style={{ backgroundColor: selected.length > 0 ? T.emerald : T.card, borderRadius: 4, paddingVertical: 16, alignItems: "center", opacity: confirming ? 0.6 : 1 }}
            onPress={confirm}
            disabled={confirming || selected.length === 0}
          >
            {confirming ? (
              <ActivityIndicator color={T.textInverse} />
            ) : (
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: selected.length > 0 ? T.textInverse : T.textSecondary }}>
                IMPORT {selected.length} TRANSACTION{selected.length !== 1 ? "S" : ""}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {editTarget && (
        <EditModal candidate={editTarget} onSave={(u) => applyEdit(editTarget.idx, u)} onClose={() => setEditTarget(null)} />
      )}
    </SafeAreaView>
  );
}
