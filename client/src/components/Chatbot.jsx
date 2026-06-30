import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";

// ─── Intent & Topic Based Knowledge ───

const KNOWLEDGE = {
  workflow: {
    timetable: `To generate a timetable, open the **Timetable** page, choose your target department, and click **Generate Timetable**. The system will automatically create a conflict-free schedule, provided you've already configured your faculty, subjects, and time slots. \n\nDo you need help adding any of that data before generating?`,
    workspace: `You can manage your team from the **Settings** page. There, you'll find your workspace details along with referral codes to invite others. Share the Admin or Viewer code depending on the level of access you want to provide.\n\nNeed help understanding the difference between the roles?`,
    data_entry: `Adding data is straightforward. Just select the category you want from the sidebar (like **Subjects** or **Faculty**), click **Add** in the top right, fill out the form, and hit save.\n\nAre you looking to add a specific type of record right now?`,
    auth: `To get started, head to the login page and sign in using your Email, Phone, or Google account. If you're registering for the first time, we'll send you a quick OTP to verify your account.\n\nAre you having any trouble logging in?`
  },
  concept: {
    timetable: `Timetable generation is an automated process that takes your academic constraints—like teacher availability and room capacities—and builds a conflict-free schedule for you.\n\nWould you like me to walk you through how to generate one, or do you want to dive into the technical details of the algorithm?`,
    workspace: `Think of workspaces as isolated environments for different schools or departments. You belong to one workspace at a time. Owners have full control to edit data, while Viewers can only suggest changes for the Owner to approve.\n\nDo you need to invite someone to your workspace?`,
    lab: `Labs are treated as special practical sessions. The system automatically schedules them as continuous blocks (usually 2-3 periods) and ensures they don't get split up by lunch breaks.\n\nAre you trying to configure a lab right now?`
  },
  technical: {
    architecture: `The application uses a modern 3-tier architecture. The frontend is built with React and Vite. The backend runs on Node.js with Express and uses Drizzle ORM to connect to a PostgreSQL database. Finally, the heavy lifting for scheduling is handled by a separate Python FastAPI microservice.\n\nDo you want to know more about the database schema or the solver API?`,
    algorithm: `Under the hood, we use Google's OR-Tools CP-SAT solver. It strictly prevents overlaps for faculty and rooms, and enforces daily hour limits. It also applies soft constraints to keep schedules compact and minimize back-to-back classes for the same subject.\n\nAre you running into an issue with the solver constraints?`,
    database: `We use PostgreSQL managed by Drizzle ORM. The core tables handle workspaces, academic departments, faculty profiles, subjects, and the final timetable entries.\n\nAre you looking for details on a specific table?`
  },
  troubleshooting: {
    generation_failed: `If the timetable fails to generate or says the constraints are too strict, it usually means the solver couldn't find a valid combination. \n\nI recommend checking that you have enough time slots for your subjects' weekly hours, and that every subject has a faculty member assigned. Also, verify that your teachers aren't exceeding their daily hour limits.\n\nDo you want to review your subject hours first?`,
    login_failed: `I can help with that. If your login isn't working, double-check that your OTP hasn't expired (they're valid for 5 minutes). If you forgot your password, you can use the "Forgot Password" link to reset it.\n\nAre you seeing a specific error message?`
  }
};

const TOPIC_KEYWORDS = {
  timetable: ["timetable", "schedule", "generate", "generation", "algorithm", "solver", "or-tools"],
  workspace: ["workspace", "team", "invite", "referral", "owner", "viewer", "role"],
  data_entry: ["subject", "faculty", "classroom", "department", "section", "timeslot", "add", "create"],
  auth: ["login", "register", "password", "otp", "auth", "account"],
  architecture: ["tech", "stack", "architecture", "built", "react", "node", "python"],
  algorithm: ["algorithm", "solver", "constraint", "cp-sat", "or-tools", "math"],
  database: ["database", "schema", "sql", "postgres", "drizzle", "table"],
  lab: ["lab", "practical", "contiguous", "block"]
};

// ─── Intent Detection System ───

function detectIntent(text) {
  const lower = text.toLowerCase();
  
  if (lower.match(/\b(how do i|where can i|help me|guide me|how to|steps to)\b/)) return "workflow";
  if (lower.match(/\b(what is|explain|how does|what are)\b/)) return "concept";
  if (lower.match(/\b(architecture|tech stack|api|database|algorithm|code|schema)\b/)) return "technical";
  if (lower.match(/\b(fix|error|bug|not working|failed|issue|problem|broken|strict)\b/)) return "troubleshooting";
  
  // Default fallback if it sounds like a greeting
  if (lower.match(/^(hi|hello|hey|greetings)/)) return "greeting";
  
  // If no strong intent, default to workflow or concept based on action words
  if (lower.match(/\b(add|create|make|generate|delete|edit)\b/)) return "workflow";
  
  return "concept";
}

function detectTopic(text, currentContext) {
  const lower = text.toLowerCase();
  
  // Check for follow-up indicators
  if (lower.match(/\b(it|that|this|do that|how|what if)\b/) && currentContext?.topic) {
    // If it's a short follow-up and we have context, keep the topic
    if (text.split(" ").length < 8) return currentContext.topic;
  }

  let bestTopic = null;
  let maxMatches = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let matches = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestTopic = topic;
    }
  }

  return bestTopic;
}

function generateResponse(intent, topic, currentContext) {
  if (intent === "greeting") {
    return {
      text: "Hello! I'm your Scheduler Assistant. I can help you navigate the app, explain how things work, or troubleshoot issues. What do you need help with today?",
      newTopic: null,
      missingInfo: false
    };
  }

  // If we couldn't detect a topic, ask a clarifying question
  if (!topic && !currentContext?.topic) {
    return {
      text: "I want to make sure I give you the right answer. Are you asking about generating the timetable, managing your workspace, adding data, or something technical?",
      newTopic: null,
      missingInfo: true
    };
  }

  const activeTopic = topic || currentContext.topic;
  
  // For technical intent, ensure we have a technical topic, otherwise fallback
  let resolvedIntent = intent;
  if (intent === "technical" && !KNOWLEDGE.technical[activeTopic]) {
    resolvedIntent = "concept";
  }

  // Fetch the knowledge based on intent and topic
  let responseText = KNOWLEDGE[resolvedIntent]?.[activeTopic];

  // Fallbacks if specific combination doesn't exist
  if (!responseText) {
    if (activeTopic === "timetable" && intent === "troubleshooting") {
      responseText = KNOWLEDGE.troubleshooting.generation_failed;
    } else if (intent === "troubleshooting") {
      responseText = "It sounds like you're running into an issue. Could you provide a bit more detail about the error message or what exactly isn't working?";
      return { text: responseText, newTopic: activeTopic, missingInfo: true };
    } else if (intent === "workflow") {
      responseText = KNOWLEDGE.workflow[activeTopic] || KNOWLEDGE.workflow.data_entry;
    } else {
      responseText = KNOWLEDGE.concept[activeTopic] || "I understand you're asking about " + activeTopic.replace("_", " ") + ". Could you specify if you need instructions on how to use it, or an explanation of how it works?";
      return { text: responseText, newTopic: activeTopic, missingInfo: true };
    }
  }

  return {
    text: responseText,
    newTopic: activeTopic,
    missingInfo: false
  };
}

// ─── Formatting Helper ───

function formatMessage(text) {
  return text.split("\\n").map((line, i) => {
    line = line.replace(/\\*\\*(.+?)\\*\\*/g, '<strong class="font-semibold text-teal-700">$1</strong>');
    
    if (line.trim().startsWith("•")) {
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-teal-500 shrink-0 mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: line.trim().slice(1).trim() }} />
        </div>
      );
    }
    
    const numMatch = line.trim().match(/^(\\d+)\\.\\s(.+)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-teal-500 font-bold shrink-0 text-xs mt-0.5 w-4 text-right">{numMatch[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: numMatch[2] }} />
        </div>
      );
    }
    
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} dangerouslySetInnerHTML={{ __html: line }} />;
  });
}

// ─── Component ───

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi! 👋 I'm your **Scheduler Assistant**. I can help you use the application, explain concepts, or troubleshoot issues.\n\nWhat can I help you with today?",
    },
  ]);
  
  // Context state for follow-up conversations
  const [context, setContext] = useState({ topic: null, lastIntent: null, missingInfo: false });
  
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatbotRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && chatbotRef.current && !chatbotRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = (text) => {
    const question = text || input.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      // 1. Detect Intent
      const intent = detectIntent(question);
      
      // 2. Detect Topic
      const topic = detectTopic(question, context);
      
      // 3. Generate Response
      const response = generateResponse(intent, topic, context);
      
      // 4. Update Context
      setContext({
        topic: response.newTopic,
        lastIntent: intent,
        missingInfo: response.missingInfo
      });

      setMessages((prev) => [...prev, { role: "bot", text: response.text }]);
      setIsTyping(false);
    }, 600 + Math.random() * 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick Questions suggestions based on missing info or starting out
  const getSuggestions = () => {
    if (messages.length === 1) {
      return ["How do I schedule a timetable?", "Explain the algorithm", "How do workspaces work?", "I have a generation error"];
    }
    if (context.missingInfo) {
      return ["Generating a timetable", "Adding faculty/subjects", "Workspace roles", "Technical architecture"];
    }
    return [];
  };

  const suggestions = getSuggestions();

  return (
    <>
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
            <span className="absolute inset-0 rounded-full animate-ping bg-teal-500/20 pointer-events-none" style={{ animationDuration: "3s" }} />
          </motion.button>
        )}
      </AnimatePresence>

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
            <div className="shrink-0 px-5 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0d2535 0%, #0f3347 50%, #0d2d3f 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl premium-gradient flex items-center justify-center shadow-lg shadow-teal-900/50">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-sm leading-tight">Scheduler Assistant</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-teal-300/80 font-medium">Context Aware</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar" style={{ background: "linear-gradient(180deg, #f0fdf9 0%, #f8fafc 40%, #f1f5f9 100%)" }}>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${msg.role === "bot" ? "bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-500/20" : "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/20"}`}>
                    {msg.role === "bot" ? <Sparkles className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${msg.role === "bot" ? "bg-white border border-teal-100/60 text-slate-700 shadow-sm rounded-tl-md" : "premium-gradient text-white shadow-md shadow-teal-600/15 rounded-tr-md"}`}>
                    {msg.role === "bot" ? formatMessage(msg.text) : <p>{msg.text}</p>}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
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

              {!isTyping && suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Suggested Questions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((q, i) => (
                      <button key={i} onClick={() => handleSend(q)} className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white border border-teal-200/60 text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-all shadow-sm cursor-pointer">
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200/80 px-3 py-1.5 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-400/20 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none py-1.5 font-medium"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
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
