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

const STUDY_MODES: { id: StudyMode; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "teach", label: "Teach Me", description: "Learn a topic with examples", icon: <GraduationCap className="h-5 w-5" /> },
  { id: "quiz", label: "Quiz Me", description: "Practice calculation problems", icon: <Brain className="h-5 w-5" /> },
  { id: "review", label: "Review Mistakes", description: "Understand past errors", icon: <AlertCircle className="h-5 w-5" /> },
  { id: "chat", label: "Free Chat", description: "Ask anything", icon: <MessageSquare className="h-5 w-5" /> },
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
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Scroll tracking
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

  useEffect(() => {
    if (!userIsScrolledUp.current) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">AI Tutor</h1>
            <p className="text-muted-foreground">
              Your personal PE Structures exam coach
              {studentCtx?.daysUntilExam !== null && studentCtx?.daysUntilExam !== undefined && (
                <span className="font-medium text-foreground">
                  {" "}&mdash; {studentCtx.daysUntilExam} days until exam
                </span>
              )}
            </p>
          </div>
          {pastSessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          )}
        </div>

        {/* History panel */}
        {showHistory && (
          <Card className="mb-6 p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Recent Conversations</p>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {pastSessions.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => resumeSession(s)}
                >
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.message_count} messages &middot;{" "}
                    {new Date(s.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Student context bar */}
        {!ctxLoading && studentCtx && studentCtx.totalAttempted > 0 && (
          <Card className="mb-6 p-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{studentCtx.studyStreak} day streak</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>{studentCtx.overallAccuracy}% accuracy</span>
                <span className="text-muted-foreground">({studentCtx.totalAttempted} Qs)</span>
              </div>
              {studentCtx.weakTopics.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-600 dark:text-orange-400">
                    Focus: {studentCtx.weakTopics.map((w) => w.label).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Study mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {STUDY_MODES.map((mode) => (
            <button
              key={mode.id}
              className="text-left rounded-xl border-2 p-6 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              onClick={() => startNewSession(mode.id)}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  {mode.icon}
                </div>
                <div>
                  <h3 className="font-semibold">{mode.label}</h3>
                  <p className="text-sm text-muted-foreground">{mode.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Suggested topics based on weak areas */}
        {studentCtx && studentCtx.weakTopics.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Recommended Focus Areas</p>
            <div className="flex flex-wrap gap-2">
              {studentCtx.weakTopics.map((w) => (
                <Badge
                  key={w.topic}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 py-1.5 px-3 text-sm border-orange-500/50 text-orange-700 dark:text-orange-400"
                  onClick={() => {
                    startNewSession("teach");
                    setTimeout(() => pickTopic(w.topic), 50);
                  }}
                >
                  {w.label} ({w.accuracy}%)
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Quick start suggestions */}
        {(!studentCtx || studentCtx.weakTopics.length === 0) && (
          <div>
            <p className="text-sm font-medium mb-3">Quick Start</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Teach me LRFD load combinations",
                "Quiz me on steel beam design",
                "Explain punching shear",
                "Walk me through a column design",
              ].map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 py-1.5 px-3 text-sm"
                  onClick={() => {
                    startNewSession("chat");
                    setTimeout(() => sendMessageDirect(suggestion), 100);
                  }}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mode selected but no messages yet: show topic picker (for teach/quiz/review)
  if (studyMode !== "chat" && messages.length === 0 && !selectedTopic) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              {STUDY_MODES.find((m) => m.id === studyMode)?.label}
            </h1>
            <p className="text-muted-foreground">
              {STUDY_MODES.find((m) => m.id === studyMode)?.description}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={newChat}>
            <X className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <p className="text-sm font-medium mb-4">Pick a topic to get started:</p>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          {NCEES_TOPICS.map((topic) => {
            const subtopics = TOPIC_SUBTOPICS[topic];
            const isWeak = studentCtx?.weakTopics.some((w) => w.topic === topic);

            return (
              <Card key={topic} className="p-4">
                <button
                  className="w-full text-left flex items-center justify-between mb-2"
                  onClick={() => pickTopic(topic)}
                >
                  <div className="flex items-center gap-2">
                    {isWeak && <AlertCircle className="h-4 w-4 text-orange-500" />}
                    <h3 className="font-medium text-sm">
                      {TOPIC_SHORT_LABELS[topic]}
                    </h3>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {subtopics.map((sub) => (
                    <Badge
                      key={sub}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 text-xs"
                      onClick={() => {
                        setSelectedTopic(topic);
                        pickSubtopic(sub);
                      }}
                    >
                      {sub}
                    </Badge>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Active chat session
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
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
          {messages.map((message) => (
            <div
              key={message.id}
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
          <div ref={scrollRef} />
        </div>
      </Card>

      {/* Input */}
      <div className="mt-4 flex gap-2">
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
