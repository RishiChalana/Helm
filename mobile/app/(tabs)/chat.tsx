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
import { agentApi, reallocationApi } from "@/lib/api";

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

type ProposalState =
  | { status: "pending"; data: ReallocationProposal }
  | { status: "confirmed"; audit_log_id: number; undoDeadline: number }
  | { status: "dismissed" }
  | { status: "undone" };

interface Message {
  role: "user" | "assistant";
  content: string;
  proposal?: ReallocationProposal;
}

function ProposalCard({
  state,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  state: ProposalState;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (state.status !== "confirmed") return;
    const remaining = Math.max(
      0,
      Math.ceil((state.undoDeadline - Date.now()) / 1000)
    );
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

  // dismissed or confirmed + countdown expired
  return null;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposalStates, setProposalStates] = useState<Record<number, ProposalState>>({});
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, proposalStates]);

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
      };
      setMessages((prev) => {
        const idx = prev.length; // index this message will have
        if (newMsg.proposal) {
          setProposalStates((ps) => ({
            ...ps,
            [idx]: { status: "pending", data: newMsg.proposal! },
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

  async function handleConfirm(msgIdx: number, proposal: ReallocationProposal) {
    try {
      await reallocationApi.execute(proposal.proposal_id);
      setProposalStates((ps) => ({
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

  async function handleUndo(msgIdx: number, audit_log_id: number) {
    try {
      await reallocationApi.undo(audit_log_id);
      setProposalStates((ps) => ({ ...ps, [msgIdx]: { status: "undone" } }));
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not undo reallocation.");
    }
  }

  function handleDismiss(msgIdx: number) {
    setProposalStates((ps) => ({ ...ps, [msgIdx]: { status: "dismissed" } }));
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isUser = item.role === "user";
    const pState = proposalStates[index];

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
        {item.proposal && pState && (
          <View className="max-w-[80%] w-[80%]">
            <ProposalCard
              state={pState}
              onConfirm={() => handleConfirm(index, item.proposal!)}
              onDismiss={() => handleDismiss(index)}
              onUndo={() =>
                handleUndo(
                  index,
                  pState.status === "confirmed" ? pState.audit_log_id : item.proposal!.audit_log_id
                )
              }
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
              Ask me anything — "How much did I spend on food this month?" or "Can I free up budget
              for dining by cutting entertainment?"
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
