import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { WifiOff } from "lucide-react-native";
import { AppHeader, Button } from "@/components";
import { colors, radii, typography } from "@/constants/theme";
import { sendChatMessage, ChatMessage } from "@/services/chatbot";
import { useConnectivity } from "@/services/connectivity";

export default function ChatScreen() {
  const router = useRouter();
  const { isOnline } = useConnectivity();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm the Scheduler Assistant. Ask me about departments, faculty, sections, time slots, or how to generate a timetable.",
      },
    ]);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!isOnline) {
      setError("The AI Assistant needs an internet connection.");
      return;
    }
    setInput("");
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const reply = await sendChatMessage(next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not respond.");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the assistant. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <AppHeader
        title="AI Assistant"
        subtitle="Grounded in the project documentation"
        right={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Done</Text>
          </Pressable>
        }
      />

      {!isOnline ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.warningSoft,
          }}
        >
          <WifiOff size={16} color={colors.warning} />
          <Text style={[typography.caption, { color: colors.warning }]}>
            Internet connection required. Connect to use the AI Assistant.
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item, index }) => (
          <Bubble message={item} isLast={index === messages.length - 1} />
        )}
      />

      {error ? (
        <Text style={[typography.caption, { color: colors.danger, paddingHorizontal: 16, paddingBottom: 4 }]}>
          {error}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your workspace…"
          placeholderTextColor={colors.inkMuted}
          style={{
            flex: 1,
            minHeight: 42,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.line,
            paddingHorizontal: 14,
            fontSize: 15,
            color: colors.ink,
            backgroundColor: colors.canvas,
          }}
          onSubmitEditing={() => void handleSend()}
        />
        <Button
          label="Send"
          size="sm"
          onPress={() => void handleSend()}
          loading={sending}
          disabled={sending || !isOnline}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  const isUser = message.role === "user";
  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start", marginBottom: isLast ? 4 : 12 }}>
      <View
        style={{
          maxWidth: "82%",
          backgroundColor: isUser ? colors.primary : colors.surface,
          borderRadius: 16,
          borderBottomRightRadius: isUser ? 4 : 16,
          borderBottomLeftRadius: isUser ? 16 : 4,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.line,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={[typography.body, { color: isUser ? colors.white : colors.ink, lineHeight: 21 }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}
