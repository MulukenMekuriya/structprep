"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  Loader2,
  BookOpen,
  GraduationCap,
  Brain,
  AlertCircle,
  MessageSquare,
  History,
  Plus,
  ChevronRight,
  Target,
  Flame,
  X,
} from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { VoiceControls, MicButton } from "@/components/tutor/voice-controls";
import { TOPIC_SHORT_LABELS, TOPIC_SUBTOPICS, NCEES_TOPICS, type NCEESTopic } from "@/types";

type StudyMode = "teach" | "quiz" | "review" | "chat";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { source: string; section: string; page: number }[];
}

interface TutorSession {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface StudentContext {
  name: string | null;
  daysUntilExam: number | null;
  studyStreak: number;
  totalAttempted: number;
  overallAccuracy: number;
  weakTopics: { topic: string; label: string; accuracy: number }[];
  weakSubtopics: { name: string; accuracy: number }[];
}

const STUDY_MODES: {
  id: StudyMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  accent: string;
}[] = [
  {
    id: "teach",
    label: "Teach Me",
    description: "Deep-dive into a topic with code references, worked examples, and exam tips",
    icon: <GraduationCap className="h-6 w-6" />,
    gradient: "from-blue-500/10 to-indigo-500/10",
    accent: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "quiz",
    label: "Quiz Me",
    description: "PE-exam-style calculation problems graded in real time",
    icon: <Brain className="h-6 w-6" />,
    gradient: "from-emerald-500/10 to-teal-500/10",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "review",
    label: "Review Mistakes",
    description: "Walk through your errors and lock in the correct approach",
    icon: <AlertCircle className="h-6 w-6" />,
    gradient: "from-amber-500/10 to-orange-500/10",
    accent: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "chat",
    label: "Free Chat",
    description: "Ask any structural engineering question — no limits",
    icon: <MessageSquare className="h-6 w-6" />,
    gradient: "from-violet-500/10 to-purple-500/10",
    accent: "text-violet-600 dark:text-violet-400",
  },
];

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<TutorSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [studentCtx, setStudentCtx] = useState<StudentContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userIsScrolledUp = useRef(false);

  // Load student context + past sessions on mount
  useEffect(() => {
    async function load() {
      try {
        const [ctxRes, sessRes] = await Promise.all([
          fetch("/api/tutor/context"),
          fetch("/api/tutor/sessions"),
        ]);
        if (ctxRes.ok) setStudentCtx(await ctxRes.json());
        if (sessRes.ok) setPastSessions(await sessRes.json());
      } catch {
        // Non-critical
      } finally {
        setCtxLoading(false);
      }
    }
    load();
  }, []);

  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Scroll tracking: detect if user has manually scrolled up
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    function handleScroll() {
      const { scrollTop, scrollHeight, clientHeight } = container!;
      userIsScrolledUp.current = scrollHeight - scrollTop - clientHeight > 100;
    }
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // When a NEW message is added (not updated), scroll to its top
  // so the user can start reading while it streams
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      // New message was added — scroll to the start of the last message
      prevMessageCount.current = messages.length;
      lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Don't auto-scroll on content updates (streaming) — let the user read
  }, [messages]);

  // Start a new session with a mode
  function startNewSession(mode: StudyMode) {
    setStudyMode(mode);
    setMessages([]);
    setSessionId(null);
    setSelectedTopic(null);
    // For teach/quiz/review, show topic picker. For chat, go straight to chat.
    if (mode === "chat") {
      // ready to chat immediately
    }
  }

  // Start a fresh chat (reset everything)
  function newChat() {
    setStudyMode(null);
    setMessages([]);
    setSessionId(null);
    setSelectedTopic(null);
    setShowHistory(false);
  }

  // Resume a past session
  async function resumeSession(session: TutorSession) {
    setSessionId(session.id);
    setStudyMode("chat"); // past sessions load as chat
    setShowHistory(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/tutor/sessions/${session.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.map((m: { role: string; content: string }) => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.content,
          }))
        );
      }
    } catch {
      // Fallback: start fresh
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  // Pick a topic and auto-send the first message
  function pickTopic(topic: string) {
    setSelectedTopic(topic);
    const topicLabel = TOPIC_SHORT_LABELS[topic as NCEESTopic] || topic;

    const firstMessages: Record<StudyMode, string> = {
      teach: `Teach me about ${topicLabel}. Start with the key concepts and work through a PE-exam-style example.`,
      quiz: `Quiz me on ${topicLabel}. Give me a PE-exam-style calculation problem.`,
      review: `I'm struggling with ${topicLabel}. Help me review common mistakes and work through the concepts I'm getting wrong.`,
      chat: "",
    };

    if (studyMode && firstMessages[studyMode]) {
      setInput(firstMessages[studyMode]);
      // Auto-send after a tick
      setTimeout(() => {
        sendMessageDirect(firstMessages[studyMode]);
      }, 100);
    }
  }

  // Pick a subtopic for more targeted study
  function pickSubtopic(subtopic: string) {
    const firstMessages: Record<StudyMode, string> = {
      teach: `Teach me about ${subtopic}. Cover the key formulas, code sections, and walk through a PE-exam-style example.`,
      quiz: `Quiz me on ${subtopic}. Give me a realistic PE-exam-style calculation problem.`,
      review: `Help me review ${subtopic}. I keep getting these wrong — show me the common mistakes and correct approach.`,
      chat: "",
    };

    if (studyMode && firstMessages[studyMode]) {
      sendMessageDirect(firstMessages[studyMode]);
    }
  }

  async function sendMessageDirect(content: string) {
    if (!content.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      let sid = sessionId;
      if (!sid) {
        const sessionRes = await fetch("/api/tutor/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: content.trim().slice(0, 50) }),
        });
        const sessionData = await sessionRes.json();
        sid = sessionData.id;
        setSessionId(sid);
      }

      const res = await fetch(`/api/tutor/sessions/${sid}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          mode: studyMode || "chat",
          topic: selectedTopic,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });

          let displayContent = assistantContent;
          let citations: Message["citations"] = undefined;
          const citationMatch = assistantContent.match(
            /\n<!--CITATIONS:(.*?)-->/
          );
          if (citationMatch) {
            displayContent = assistantContent.replace(
              /\n<!--CITATIONS:.*?-->/,
              ""
            );
            try {
              citations = JSON.parse(citationMatch[1]);
            } catch {
              // ignore during streaming
            }
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: displayContent, citations }
                : m
            )
          );
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    await sendMessageDirect(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ---- RENDER ----

  // No mode selected: show landing screen
  if (!studyMode) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Hero section */}
        <div className="relative mb-8">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">AI Tutor</h1>
                  <p className="text-sm text-muted-foreground">
                    Your personal PE Structures exam coach
                  </p>
                </div>
              </div>
              {studentCtx?.daysUntilExam !== null && studentCtx?.daysUntilExam !== undefined && (
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium ring-1 ring-primary/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  {studentCtx.daysUntilExam} days until exam
                </div>
              )}
            </div>
            {pastSessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4 mr-1.5" />
                History
              </Button>
            )}
          </div>
        </div>

        {/* History panel */}
        {showHistory && (
          <Card className="mb-6 overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-medium">Recent Conversations</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y">
              {pastSessions.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                  onClick={() => resumeSession(s)}
                >
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.message_count} messages &middot;{" "}
                    {new Date(s.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Stats bar */}
        {!ctxLoading && studentCtx && studentCtx.totalAttempted > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="rounded-xl border bg-gradient-to-br from-orange-500/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Streak</span>
              </div>
              <p className="text-2xl font-bold">{studentCtx.studyStreak}<span className="text-sm font-normal text-muted-foreground ml-1">days</span></p>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accuracy</span>
              </div>
              <p className="text-2xl font-bold">{studentCtx.overallAccuracy}%<span className="text-sm font-normal text-muted-foreground ml-1">({studentCtx.totalAttempted} Qs)</span></p>
            </div>
            {studentCtx.weakTopics.length > 0 ? (
              <div className="rounded-xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Focus</span>
                </div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-tight">
                  {studentCtx.weakTopics.map((w) => w.label).join(", ")}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-gradient-to-br from-blue-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                </div>
                <p className="text-sm font-semibold leading-tight">On track</p>
              </div>
            )}
          </div>
        )}

        {/* Study mode section */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Choose your study mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STUDY_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`group relative text-left rounded-xl border p-5 bg-gradient-to-br ${mode.gradient} hover:shadow-md hover:border-primary/20 transition-all duration-200`}
                onClick={() => startNewSession(mode.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border ${mode.accent} group-hover:shadow-md transition-shadow`}>
                    {mode.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[15px] mb-0.5 group-hover:text-primary transition-colors">{mode.label}</h3>
                    <p className="text-[13px] text-muted-foreground leading-snug">{mode.description}</p>
                  </div>
                </div>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Weak areas */}
        {studentCtx && studentCtx.weakTopics.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommended focus areas</h2>
            <div className="flex flex-wrap gap-2">
              {studentCtx.weakTopics.map((w) => (
                <button
                  key={w.topic}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 transition-colors"
                  onClick={() => {
                    startNewSession("teach");
                    setTimeout(() => pickTopic(w.topic), 50);
                  }}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {w.label}
                  <span className="text-amber-600/60 dark:text-amber-400/60">{w.accuracy}%</span>
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick start */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick start</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { text: "Teach me LRFD load combinations", icon: <GraduationCap className="h-3.5 w-3.5" /> },
              { text: "Quiz me on steel beam design", icon: <Brain className="h-3.5 w-3.5" /> },
              { text: "Explain punching shear", icon: <MessageSquare className="h-3.5 w-3.5" /> },
              { text: "Walk me through a column design", icon: <GraduationCap className="h-3.5 w-3.5" /> },
            ].map((suggestion) => (
              <button
                key={suggestion.text}
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-sm hover:bg-muted/80 hover:border-primary/20 transition-all"
                onClick={() => {
                  startNewSession("chat");
                  setTimeout(() => sendMessageDirect(suggestion.text), 100);
                }}
              >
                <span className="text-muted-foreground">{suggestion.icon}</span>
                {suggestion.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Mode selected but no messages yet: show topic picker (for teach/quiz/review)
  if (studyMode !== "chat" && messages.length === 0 && !selectedTopic) {
    const currentMode = STUDY_MODES.find((m) => m.id === studyMode)!;
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentMode.gradient} ring-1 ring-border ${currentMode.accent}`}>
              {currentMode.icon}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{currentMode.label}</h1>
              <p className="text-sm text-muted-foreground">{currentMode.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={newChat}>
            <X className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Select a topic</h2>

        <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
          {NCEES_TOPICS.map((topic) => {
            const subtopics = TOPIC_SUBTOPICS[topic];
            const isWeak = studentCtx?.weakTopics.some((w) => w.topic === topic);
            const weakData = studentCtx?.weakTopics.find((w) => w.topic === topic);

            return (
              <div key={topic} className="rounded-xl border overflow-hidden">
                <button
                  className="w-full text-left flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors"
                  onClick={() => pickTopic(topic)}
                >
                  <div className="flex items-center gap-3">
                    {isWeak && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    )}
                    <span className="font-medium text-sm">{TOPIC_SHORT_LABELS[topic]}</span>
                    {weakData && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {weakData.accuracy}% accuracy
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
                <div className="flex flex-wrap gap-1.5 px-4 pb-3.5 pt-0">
                  {subtopics.map((sub) => (
                    <button
                      key={sub}
                      className="text-xs rounded-md border bg-card px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:border-primary/20 transition-all"
                      onClick={() => {
                        setSelectedTopic(topic);
                        pickSubtopic(sub);
                      }}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active chat session
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 6rem)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {STUDY_MODES.find((m) => m.id === studyMode)?.icon || <Bot className="h-4 w-4" />}
          </div>
          <div>
            <h2 className="font-semibold text-sm">
              {STUDY_MODES.find((m) => m.id === studyMode)?.label || "AI Tutor"}
            </h2>
            {selectedTopic && (
              <p className="text-xs text-muted-foreground">
                {TOPIC_SHORT_LABELS[selectedTopic as NCEESTopic] || selectedTopic}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={newChat}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <Card ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message, idx) => (
            <div
              key={message.id}
              ref={idx === messages.length - 1 ? lastMessageRef : undefined}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : ""
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className="max-w-[80%] space-y-2">
                <div
                  className={`rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    message.content ? (
                      <Markdown>{message.content}</Markdown>
                    ) : (
                      loading &&
                      message === messages[messages.length - 1] && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )
                    )
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>
                {message.citations && message.citations.length > 0 && (
                  <div className="flex items-start gap-1.5 flex-wrap px-1">
                    <BookOpen className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    {message.citations.map((c, ci) => {
                      const label = `${c.source}${c.section !== "General" ? ` ${c.section}` : ""}${c.page > 0 ? ` p.${c.page}` : ""}`;
                      const searchQuery = c.section !== "General" ? `${c.source} ${c.section}` : c.source;
                      return (
                        <Badge
                          key={ci}
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 text-muted-foreground cursor-pointer hover:bg-primary/10 hover:text-foreground transition-colors"
                          onClick={() =>
                            window.open(
                              `/references?q=${encodeURIComponent(searchQuery)}`,
                              "_blank"
                            )
                          }
                        >
                          {label} ↗
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {message.role === "assistant" && message.content && !loading && (
                  <div className="px-1">
                    <VoiceControls
                      messageContent={message.content}
                      onTranscript={setInput}
                      onSendTranscript={sendMessageDirect}
                      disabled={loading}
                    />
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          <div />
        </div>
      </Card>

      {/* Input */}
      <div className="mt-4 flex gap-2 shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            studyMode === "quiz"
              ? "Type or speak your answer..."
              : studyMode === "teach"
                ? "Ask a follow-up or tap the mic..."
                : "Ask about structural engineering..."
          }
          className="min-h-[60px] resize-none"
          disabled={loading}
        />
        <MicButton
          onTranscript={setInput}
          onSendTranscript={sendMessageDirect}
          disabled={loading}
        />
        <Button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          size="icon"
          className="h-[60px] w-[60px] shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
