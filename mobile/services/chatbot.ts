/**
 * Chatbot service.
 *
 * The Gemini assistant is cloud-only and already exists as a backend endpoint
 * (POST /api/chatbot). The mobile app is a thin client — no Gemini keys, no AI
 * SDK, no duplicated provider logic. Offline, the UI shows the "connect to the
 * internet" state; nothing else depends on the assistant.
 */
import { api } from "./api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const res = await api.post<{ reply: string }>(
    "/api/chatbot",
    { messages: messages.slice(-30) },
    { timeoutMs: 60_000 },
  );
  return res.data.reply;
}
