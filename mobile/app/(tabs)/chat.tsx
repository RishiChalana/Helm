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
      <View className="mt-2 rounded-xl border border-accent bg-surface px-4 py-4">
        <Text className="text-accent text-xs font-semibold mb-1 uppercase tracking-wide">
          Budget Reallocation Proposal
        </Text>
        <Text className="text-text-primary text-sm mb-3 leading-5">{p.description}</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-accent rounded-lg py-3 items-center"
            onPress={onConfirm}
          >
            <Text className="text-white font-semibold text-sm">Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-card border border-border rounded-lg py-3 items-center"
            onPress={onDismiss}
          >
            <Text className="text-text-secondary font-semibold text-sm">Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state.status === "confirmed" && secondsLeft > 0) {
    return (
      <View className="mt-2 rounded-xl border border-accent-2 bg-surface px-4 py-3 flex-row items-center justify-between">
        <Text className="text-accent-2 text-sm font-medium">Budgets updated ✓</Text>
        <TouchableOpacity
          className="bg-card border border-border rounded-lg px-3 py-2"
          onPress={onUndo}
        >
          <Text className="text-text-primary text-sm font-medium">Undo ({secondsLeft}s)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state.status === "undone") {
    return (
      <View className="mt-2 rounded-xl border border-border bg-surface px-4 py-3">
        <Text className="text-text-secondary text-sm">Reallocation undone — budgets reverted.</Text>
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
      <View className="mt-2 rounded-xl border border-accent-2 bg-surface px-4 py-4">
        <Text className="text-accent-2 text-xs font-semibold mb-1 uppercase tracking-wide">
          Savings Goal Proposal
        </Text>
        <Text className="text-text-primary font-semibold text-base mb-1">{p.description}</Text>

        <View className="flex-row gap-4 mb-3 mt-1">
          <View className="flex-1">
            <Text className="text-text-secondary text-xs mb-0.5">Monthly savings</Text>
            <Text className="text-text-primary font-semibold text-sm">
              ₹{p.monthly_amount.toLocaleString("en-IN")}
            </Text>
          </View>
          {p.target_amount > 0 && (
            <View className="flex-1">
              <Text className="text-text-secondary text-xs mb-0.5">Target</Text>
              <Text className="text-text-primary font-semibold text-sm">
                ₹{p.target_amount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}
          {p.months_to_goal !== null && (
            <View className="flex-1">
              <Text className="text-text-secondary text-xs mb-0.5">Timeline</Text>
              <Text className="text-text-primary font-semibold text-sm">
                {p.months_to_goal} mo
              </Text>
            </View>
          )}
        </View>

        <Text className="text-text-secondary text-xs leading-4 mb-3">{p.reasoning}</Text>

        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-accent-2 rounded-lg py-3 items-center"
            onPress={onConfirm}
          >
            <Text className="text-white font-semibold text-sm">Set Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-card border border-border rounded-lg py-3 items-center"
            onPress={onDismiss}
          >
            <Text className="text-text-secondary font-semibold text-sm">Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state.status === "confirmed") {
    return (
      <View className="mt-2 rounded-xl border border-accent-2 bg-surface px-4 py-3">
        <Text className="text-accent-2 text-sm font-medium">Goal created ✓</Text>
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
          setReallocationStates((ps) => ({
            ...ps,
            [idx]: { status: "pending", data: newMsg.proposal! },
          }));
        }
        if (newMsg.goal_proposal) {
          setGoalStates((gs) => ({
            ...gs,
            [idx]: { status: "pending", data: newMsg.goal_proposal! },
          }));
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

  // ── Reallocation handlers ─────────────────────────────────────────────────

  async function handleReallocationConfirm(msgIdx: number, proposal: ReallocationProposal) {
    try {
      await reallocationApi.execute(proposal.proposal_id);
      setReallocationStates((ps) => ({
        ...ps,
        [msgIdx]: {
          status: "confirmed",
          audit_log_id: proposal.audit_log_id,
          undoDeadline: Date.now() + 30_000,
        },
      }));
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not apply reallocation.");
    }
  }

  async function handleReallocationUndo(msgIdx: number, audit_log_id: number) {
    try {
      await reallocationApi.undo(audit_log_id);
      setReallocationStates((ps) => ({ ...ps, [msgIdx]: { status: "undone" } }));
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not undo reallocation.");
    }
  }

  function handleReallocationDismiss(msgIdx: number) {
    setReallocationStates((ps) => ({ ...ps, [msgIdx]: { status: "dismissed" } }));
  }

  // ── Goal handlers ─────────────────────────────────────────────────────────

  async function handleGoalConfirm(msgIdx: number, proposal: GoalProposal) {
    try {
      const res = await goalApi.confirm({
        description: proposal.description,
        target_amount: proposal.target_amount,
        monthly_amount: proposal.monthly_amount,
        target_date: proposal.target_date ?? undefined,
        reasoning: proposal.reasoning,
      });
      setGoalStates((gs) => ({
        ...gs,
        [msgIdx]: { status: "confirmed", goal_id: res.data.id },
      }));
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not create goal.");
    }
  }

  function handleGoalDismiss(msgIdx: number) {
    setGoalStates((gs) => ({ ...gs, [msgIdx]: { status: "dismissed" } }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isUser = item.role === "user";
    const rState = reallocationStates[index];
    const gState = goalStates[index];

    return (
      <View className={`mb-3 ${isUser ? "items-end" : "items-start"}`}>
        <View
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isUser ? "bg-accent" : "bg-card border border-border"
          }`}
        >
          <Text className={`text-base leading-5 ${isUser ? "text-white" : "text-text-primary"}`}>
            {item.content}
          </Text>
        </View>

        {item.proposal && rState && (
          <View className="max-w-[80%] w-[80%]">
            <ProposalCard
              state={rState}
              onConfirm={() => handleReallocationConfirm(index, item.proposal!)}
              onDismiss={() => handleReallocationDismiss(index)}
              onUndo={() =>
                handleReallocationUndo(
                  index,
                  rState.status === "confirmed"
                    ? rState.audit_log_id
                    : item.proposal!.audit_log_id
                )
              }
            />
          </View>
        )}

        {item.goal_proposal && gState && (
          <View className="max-w-[80%] w-[80%]">
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
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 py-3 border-b border-border">
        <Text className="text-text-primary text-lg font-semibold">Helm</Text>
        <Text className="text-text-secondary text-xs">Your AI finance copilot</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-20">
            <Text className="text-text-secondary text-center px-8">
              Ask me anything — "Help me set a savings goal for ₹1,00,000" or "Can I free up
              budget for dining by cutting entertainment?"
            </Text>
          </View>
        }
      />

      {loading && (
        <View className="px-4 pb-2">
          <ActivityIndicator color="#6C63FF" />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View className="flex-row items-center px-4 py-3 border-t border-border gap-3">
          <TextInput
            className="flex-1 bg-card text-text-primary rounded-xl px-4 py-3 text-base border border-border"
            placeholder="Message Helm..."
            placeholderTextColor="#8888A0"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            className="bg-accent rounded-xl px-4 py-3"
            onPress={send}
            disabled={loading}
          >
            <Text className="text-white font-semibold">Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
