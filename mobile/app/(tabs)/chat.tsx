import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { agentApi, reallocationApi, goalApi } from "@/lib/api";
import { T, F, fmtINR, apiErrMsg } from "@/lib/design";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReallocationProposal {
  proposal_id: string;
  audit_log_id: number;
  from_category: string;
  to_category: string;
  amount: number;
  from_old_limit: number;
  from_new_limit: number;
  to_old_limit: number | null;
  to_new_limit: number | null;
  description: string;
}

interface GoalProposal {
  description: string;
  target_amount: number;
  monthly_amount: number;
  target_date: string | null;
  reasoning: string;
  months_to_goal: number | null;
  monthly_income: number;
  monthly_expense: number;
  monthly_surplus: number;
}

type ReallocationState =
  | { status: "pending"; data: ReallocationProposal }
  | { status: "confirmed"; audit_log_id: number; undoDeadline: number }
  | { status: "dismissed" }
  | { status: "undone" };

type GoalState =
  | { status: "pending"; data: GoalProposal }
  | { status: "confirmed"; goal_id: number }
  | { status: "dismissed" };

interface Message {
  role: "user" | "assistant";
  content: string;
  proposal?: ReallocationProposal;
  goal_proposal?: GoalProposal;
}

// ── Reallocation ProposalCard ─────────────────────────────────────────────────

function ProposalCard({
  state,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  state: ReallocationState;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (state.status !== "confirmed") return;
    const remaining = Math.max(0, Math.ceil((state.undoDeadline - Date.now()) / 1000));
    setSecondsLeft(remaining);
    if (remaining === 0) return;
    const interval = setInterval(() => {
      const s = Math.max(0, Math.ceil((state.undoDeadline - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  if (state.status === "pending") {
    const p = state.data;
    return (
      <View style={{ marginTop: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.borderHi, borderRadius: 4, padding: 16 }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.gold, marginBottom: 12 }}>
          BUDGET REALLOCATION
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 4, padding: 12 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 4 }}>
              FROM
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {p.from_category}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, lineHeight: 16, color: T.coral, marginTop: 4 }}>
              {fmtINR(p.from_new_limit)} limit
            </Text>
          </View>

          <Text style={{ fontFamily: F.sans, fontSize: 16, color: T.textDim }}>→</Text>

          <View style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 4, padding: 12 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 4 }}>
              TO
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {p.to_category}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, lineHeight: 16, color: T.emerald, marginTop: 4 }}>
              {p.to_new_limit != null ? `${fmtINR(p.to_new_limit)} limit` : `+${fmtINR(p.amount)}`}
            </Text>
          </View>
        </View>

        <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 26, color: T.textSecondary, marginBottom: 16 }}>
          {p.description}
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: T.emerald, borderRadius: 4, paddingVertical: 12, alignItems: "center" }}
            onPress={onConfirm}
          >
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textInverse }}>
              CONFIRM
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingVertical: 12, alignItems: "center" }}
            onPress={onDismiss}
          >
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
              DISMISS
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state.status === "confirmed" && secondsLeft > 0) {
    return (
      <View style={{ marginTop: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald }}>
          BUDGETS UPDATED ✓
        </Text>
        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: T.borderHi, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 }}
          onPress={onUndo}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
            Undo ({secondsLeft}s)
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state.status === "undone") {
    return (
      <View style={{ marginTop: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textDim }}>
          Reallocation undone — budgets reverted.
        </Text>
      </View>
    );
  }

  return null;
}

// ── Goal ProposalCard ─────────────────────────────────────────────────────────

function GoalProposalCard({
  state,
  onConfirm,
  onDismiss,
}: {
  state: GoalState;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  if (state.status === "pending") {
    const p = state.data;
    return (
      <View style={{ marginTop: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.borderHi, borderRadius: 4, padding: 16 }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.gold, marginBottom: 12 }}>
          SAVINGS GOAL
        </Text>

        <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary, marginBottom: 12 }}>
          {p.description}
        </Text>

        <View style={{ flexDirection: "row", marginBottom: 12, gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 4 }}>
              MONTHLY
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {fmtINR(p.monthly_amount)}
            </Text>
          </View>
          {p.target_amount > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 4 }}>
                TARGET
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
                {fmtINR(p.target_amount)}
              </Text>
            </View>
          )}
          {p.months_to_goal !== null && (
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary, marginBottom: 4 }}>
                TIMELINE
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
                {p.months_to_goal} mo
              </Text>
            </View>
          )}
        </View>

        <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: T.textSecondary, marginBottom: 16 }}>
          {p.reasoning}
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: T.gold, borderRadius: 4, paddingVertical: 12, alignItems: "center" }}
            onPress={onConfirm}
          >
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textInverse }}>
              SET GOAL
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingVertical: 12, alignItems: "center" }}
            onPress={onDismiss}
          >
            <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textSecondary }}>
              DISMISS
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state.status === "confirmed") {
    return (
      <View style={{ marginTop: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.gold }}>
          GOAL CREATED ✓
        </Text>
      </View>
    );
  }

  return null;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reallocationStates, setReallocationStates] = useState<Record<number, ReallocationState>>({});
  const [goalStates, setGoalStates] = useState<Record<number, GoalState>>({});
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, reallocationStates, goalStates]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await agentApi.chat(text, conversationId);
      setConversationId(res.data.conversation_id);
      const newMsg: Message = {
        role: "assistant",
        content: res.data.reply,
        proposal: res.data.proposal ?? undefined,
        goal_proposal: res.data.goal_proposal ?? undefined,
      };
      setMessages((prev) => {
        const idx = prev.length;
        if (newMsg.proposal) {
          setReallocationStates((ps) => ({ ...ps, [idx]: { status: "pending", data: newMsg.proposal! } }));
        }
        if (newMsg.goal_proposal) {
          setGoalStates((gs) => ({ ...gs, [idx]: { status: "pending", data: newMsg.goal_proposal! } }));
        }
        return [...prev, newMsg];
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReallocationConfirm(msgIdx: number, proposal: ReallocationProposal) {
    try {
      await reallocationApi.execute(proposal.proposal_id);
      setReallocationStates((ps) => ({
        ...ps,
        [msgIdx]: { status: "confirmed", audit_log_id: proposal.audit_log_id, undoDeadline: Date.now() + 30_000 },
      }));
    } catch (err: any) {
      Alert.alert("Error", apiErrMsg(err, "Could not apply reallocation."));
    }
  }

  async function handleReallocationUndo(msgIdx: number, audit_log_id: number) {
    try {
      await reallocationApi.undo(audit_log_id);
      setReallocationStates((ps) => ({ ...ps, [msgIdx]: { status: "undone" } }));
    } catch (err: any) {
      Alert.alert("Error", apiErrMsg(err, "Could not undo reallocation."));
    }
  }

  function handleReallocationDismiss(msgIdx: number) {
    setReallocationStates((ps) => ({ ...ps, [msgIdx]: { status: "dismissed" } }));
  }

  async function handleGoalConfirm(msgIdx: number, proposal: GoalProposal) {
    try {
      const res = await goalApi.confirm({
        description: proposal.description,
        target_amount: proposal.target_amount,
        monthly_amount: proposal.monthly_amount,
        target_date: proposal.target_date ?? undefined,
        reasoning: proposal.reasoning,
      });
      setGoalStates((gs) => ({ ...gs, [msgIdx]: { status: "confirmed", goal_id: res.data.id } }));
    } catch (err: any) {
      Alert.alert("Error", apiErrMsg(err, "Could not create goal."));
    }
  }

  function handleGoalDismiss(msgIdx: number) {
    setGoalStates((gs) => ({ ...gs, [msgIdx]: { status: "dismissed" } }));
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isUser = item.role === "user";
    const rState = reallocationStates[index];
    const gState = goalStates[index];

    return (
      <View style={{ marginBottom: 16, alignItems: isUser ? "flex-end" : "flex-start" }}>
        <View
          style={{
            maxWidth: "82%",
            borderRadius: 4,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isUser ? T.surface : T.card,
            borderWidth: 1,
            borderColor: isUser ? T.borderHi : T.border,
          }}
        >
          <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 26, color: T.textPrimary }}>
            {item.content}
          </Text>
        </View>

        {item.proposal && rState && (
          <View style={{ maxWidth: "88%", width: "88%" }}>
            <ProposalCard
              state={rState}
              onConfirm={() => handleReallocationConfirm(index, item.proposal!)}
              onDismiss={() => handleReallocationDismiss(index)}
              onUndo={() =>
                handleReallocationUndo(
                  index,
                  rState.status === "confirmed" ? rState.audit_log_id : item.proposal!.audit_log_id
                )
              }
            />
          </View>
        )}

        {item.goal_proposal && gState && (
          <View style={{ maxWidth: "88%", width: "88%" }}>
            <GoalProposalCard
              state={gState}
              onConfirm={() => handleGoalConfirm(index, item.goal_proposal!)}
              onDismiss={() => handleGoalDismiss(index)}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary }}>
          Helm
        </Text>
        <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.textDim, marginTop: 2 }}>
          AI FINANCE COPILOT
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 8 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: 64, paddingHorizontal: 32 }}>
            <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: T.textPrimary, textAlign: "center", marginBottom: 12 }}>
              Good morning
            </Text>
            <Text style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 26, color: T.textSecondary, textAlign: "center" }}>
              Ask me to analyse your spending, suggest budget adjustments, or set a savings goal.
            </Text>
          </View>
        }
      />

      {loading && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, alignItems: "flex-start" }}>
          <View style={{ backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10 }}>
            <ActivityIndicator size="small" color={T.emerald} />
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.border, gap: 10 }}>
          <TextInput
            style={{
              fontFamily: F.sans,
              fontSize: 16,
              lineHeight: 24,
              color: T.textPrimary,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: T.borderHi,
            }}
            placeholder="Message Helm..."
            placeholderTextColor={T.textDim}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
          />
          <View style={{ alignItems: "flex-end" }}>
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor: T.emerald,
                borderRadius: 4,
                paddingHorizontal: 20,
                paddingVertical: 10,
                opacity: loading ? 0.5 : 1,
              }}
              onPress={send}
              disabled={loading}
            >
              <Text style={{ fontFamily: F.sansMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.65, color: T.emerald }}>
                SEND
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
