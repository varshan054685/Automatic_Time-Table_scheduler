import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles, AlertCircle } from "lucide-react";

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Send the full conversation history to the backend chatbot endpoint.
 * The backend handles doc retrieval + Gemini integration.
 * Returns the assistant reply text, or throws on error.
 */
async function sendChatMessage(messages) {
  const res = await fetch("/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    let errMsg = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      if (body?.message) errMsg = body.message;
    } catch {
      // ignore parse error
    }
    // Give the user actionable context based on status code
    if (res.status === 401 || res.status === 403) {
      errMsg = "Session expired. Please refresh the page and sign in again.";
    } else if (res.status === 429) {
      errMsg = "The assistant is temporarily rate-limited. Please wait a moment and try again.";
    } else if (res.status === 503) {
      errMsg = "The assistant is not configured on this server. Please contact your administrator.";
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  if (!data?.reply) throw new Error("Received an empty response. Please try again.");
  return data.reply;
}

// ─── Formatting Helper ────────────────────────────────────────────────────────
// Renders markdown-like text (bold, bullets, numbered lists) into React elements.

function formatMessage(text) {
  return text.split("\n").map((line, i) => {
    // Bold: **text**
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-teal-700">$1</strong>');

    // Bullet lines
    if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
      const content = line.trim().slice(1).trim();
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-teal-500 shrink-0 mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    }

    // Numbered list lines
    const numMatch = line.trim().match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-teal-500 font-bold shrink-0 text-xs mt-0.5 w-4 text-right">{numMatch[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: numMatch[2] }} />
        </div>
      );
    }

    // Blank lines → small spacer
    if (!line.trim()) return <div key={i} className="h-2" />;

    return <p key={i} dangerouslySetInnerHTML={{ __html: line }} />;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  // Full conversation history — sent to the backend with every request.
  // Shape: { role: "user" | "assistant", content: string }[]
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! 👋 I'm your **Scheduler Assistant**. I can help you use the application, explain features, or troubleshoot issues.\n\nWhat can I help you with today?",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null); // inline error shown in chat

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatbotRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && chatbotRef.current && !chatbotRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // ── Send a message ─────────────────────────────────────────────────────────

  const handleSend = async (text) => {
    const question = (text ?? input).trim();
    if (!question || isLoading) return;

    setInput("");
    setError(null);

    // Append the user message immediately so the UI feels responsive
    const userMsg = { role: "user", content: question };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Send full history (excluding the initial greeting to save tokens)
      // We strip the first assistant greeting after the first real exchange
      const historyToSend = updatedMessages
        .filter((m, idx) => {
          // Always include if it's a user message or not the very first assistant message
          if (m.role === "user") return true;
          if (idx === 0 && m.role === "assistant") return false; // skip opening greeting
          return true;
        })
        .map((m) => ({ role: m.role, content: m.content }));

      // Need at least one message
      const payload = historyToSend.length > 0 ? historyToSend : [userMsg];

      const reply = await sendChatMessage(payload);

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Suggested questions ────────────────────────────────────────────────────
  // Show initial suggestions on load; hide once conversation has started.
  const showSuggestions = messages.length === 1;
  const suggestions = [
    "How do I generate a timetable?",
    "How do change requests work?",
    "What are the scheduling constraints?",
    "How do I add faculty members?",
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full premium-gradient shadow-xl shadow-teal-600/30 flex items-center justify-center cursor-pointer group"
          >
            <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <span
              className="absolute inset-0 rounded-full animate-ping bg-teal-500/20 pointer-events-none"
              style={{ animationDuration: "3s" }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatbotRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 border border-white/40"
          >
            {/* Header */}
            <div
              className="shrink-0 px-5 py-4 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #0d2535 0%, #0f3347 50%, #0d2d3f 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl premium-gradient flex items-center justify-center shadow-lg shadow-teal-900/50">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-sm leading-tight">
                    Scheduler Assistant
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-teal-300/80 font-medium">
                      {isLoading ? "Thinking…" : "Documentation Aware"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar"
              style={{
                background: "linear-gradient(180deg, #f0fdf9 0%, #f8fafc 40%, #f1f5f9 100%)",
              }}
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                      msg.role === "assistant"
                        ? "bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-500/20"
                        : "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/20"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      msg.role === "assistant"
                        ? "bg-white border border-teal-100/60 text-slate-700 shadow-sm rounded-tl-md"
                        : "premium-gradient text-white shadow-md shadow-teal-600/15 rounded-tr-md"
                    }`}
                  >
                    {msg.role === "assistant"
                      ? formatMessage(msg.content)
                      : <p>{msg.content}</p>}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2.5"
                >
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white border border-teal-100/60 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Inline error message */}
              {error && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5"
                >
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-rose-100 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div className="max-w-[82%] rounded-2xl rounded-tl-md px-4 py-3 text-[13px] leading-relaxed bg-rose-50 border border-rose-200 text-rose-700 shadow-sm">
                    <p>{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Initial suggested questions */}
              {showSuggestions && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 pt-1"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                    Suggested Questions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(q)}
                        disabled={isLoading}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white border border-teal-200/60 text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200/80 px-3 py-1.5 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-400/20 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question…"
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none py-1.5 font-medium disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-2 rounded-lg premium-gradient text-white disabled:opacity-40 hover:shadow-md hover:shadow-teal-500/20 transition-all disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
