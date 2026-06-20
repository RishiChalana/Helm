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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { agentApi } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await agentApi.chat(text, conversationId);
      setConversationId(res.data.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === "user";
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
              Ask me anything — "How much did I spend on food this month?" or "Am I on track with
              my rent budget?"
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
