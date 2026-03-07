"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QuestionCard } from "@/components/question/question-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Question, StudySession } from "@/types";

interface AttemptResult {
  is_correct: boolean;
  correct_option_id: string;
}

export function PracticeSessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topic = searchParams.get("topic");
  const mode = searchParams.get("mode"); // "weak-areas" for targeted practice
  const questionLimit = parseInt(searchParams.get("count") || "10", 10);
  const timeLimitMin = parseInt(searchParams.get("time") || "0", 10);

  const [session, setSession] = useState<StudySession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timeLimitMin * 60); // seconds
  const [timedOut, setTimedOut] = useState(false);

  const initSession = useCallback(async () => {
    try {
      // 1. Create study session
      const sessionRes = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "practice",
          topic_filter: topic || null,
        }),
      });

      if (!sessionRes.ok) throw new Error("Failed to create session");
      const sessionData = await sessionRes.json();
      setSession(sessionData);

      // 2. Fetch questions
      let questionsData: Question[];

      if (mode === "weak-areas") {
        const weakRes = await fetch(`/api/questions/weak-areas?limit=${questionLimit}`);
        if (!weakRes.ok) throw new Error("Failed to fetch weak area questions");
        const weakData = await weakRes.json();
        questionsData = weakData.questions;
        if (weakData.message && questionsData.length === 0) {
          setError(weakData.message);
          return;
        }
      } else {
        const params = new URLSearchParams({ limit: String(questionLimit) });
        if (topic) params.set("topic", topic);
        const questionsRes = await fetch(`/api/questions?${params}`);
        if (!questionsRes.ok) throw new Error("Failed to fetch questions");
        questionsData = await questionsRes.json();
      }

      if (!questionsData || questionsData.length === 0) {
        setError("No questions available for this topic yet.");
        return;
      }

      setQuestions(questionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [topic, questionLimit, mode]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Session timer (countdown if time limit set)
  useEffect(() => {
    if (timeLimitMin <= 0 || finished || loading || timedOut) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLimitMin, finished, loading, timedOut]);

  async function handleAnswer(optionId: string, timeSpent: number) {
    if (!session || !questions[currentIndex]) return;

    const question = questions[currentIndex];

    try {
      const res = await fetch(`/api/questions/${question.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_option_id: optionId,
          time_spent_sec: timeSpent,
          flagged: false,
          hints_used: hintsUsed,
          session_id: session.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit answer");
      const result = await res.json();

      setResults((prev) => [
        ...prev,
        {
          is_correct: result.is_correct,
          correct_option_id: result.correct_option_id,
        },
      ]);
    } catch {
      // Still show the answer even if API fails
      setResults((prev) => [
        ...prev,
        {
          is_correct: optionId === question.correct_option_id,
          correct_option_id: question.correct_option_id,
        },
      ]);
    }
  }

  async function handleHint(level: 1 | 2 | 3) {
    const question = questions[currentIndex];
    if (!question) return;

    setHintLoading(true);
    setHintsUsed(level);

    try {
      const res = await fetch(`/api/questions/${question.id}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });

      if (!res.ok) throw new Error("Failed to get hint");
      const data = await res.json();
      setHintText(data.hint);
    } catch {
      setHintText("Could not generate hint. Try again.");
    } finally {
      setHintLoading(false);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setHintText(null);
      setHintsUsed(0);
    } else {
      finishSession();
    }
  }

  async function finishSession() {
    setFinished(true);

    if (session) {
      try {
        await fetch(`/api/sessions/${session.id}`, { method: "PATCH" });
      } catch {
        // Non-critical
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push("/practice")}>Back to Practice</Button>
      </div>
    );
  }

  if (finished) {
    const correct = results.filter((r) => r.is_correct).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const scoreColor = pct >= 70 ? "text-green-500" : pct >= 50 ? "text-yellow-500" : "text-red-500";
    const message = pct >= 80
      ? "Excellent work!"
      : pct >= 70
        ? "Solid performance"
        : pct >= 50
          ? "Keep practicing"
          : "Review these topics";

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="overflow-hidden">
          <div className="text-center pt-8 pb-6 px-6">
            <div className={`text-6xl font-bold tabular-nums ${scoreColor}`}>
              {pct}<span className="text-3xl">%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {correct} of {total} correct · {message}
            </p>
            <Progress value={pct} className="h-1.5 mt-4 max-w-xs mx-auto" />
          </div>

          <CardContent className="space-y-1.5 pb-6">
            {questions.map((q, i) => {
              const wasCorrect = results[i]?.is_correct;
              return (
                <div
                  key={q.id}
                  className={`flex items-center gap-2.5 rounded-lg p-2.5 transition-colors ${
                    wasCorrect ? "hover:bg-green-500/5" : "hover:bg-red-500/5"
                  }`}
                >
                  {wasCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <p className="text-sm flex-1 line-clamp-1 text-muted-foreground">
                    {q.question_text}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      q.difficulty === "hard"
                        ? "border-red-500/20 text-red-500"
                        : q.difficulty === "medium"
                          ? "border-yellow-500/20 text-yellow-500"
                          : "border-green-500/20 text-green-500"
                    }`}
                  >
                    {q.difficulty}
                  </Badge>
                </div>
              );
            })}
          </CardContent>

          <div className="flex gap-3 justify-center border-t p-4 bg-muted/20">
            <Button variant="outline" size="sm" onClick={() => router.push("/practice")}>
              Back to Topics
            </Button>
            <Button size="sm" onClick={() => window.location.reload()}>
              Practice Again
            </Button>
            {pct < 70 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/practice/session?mode=weak-areas&count=10")}
                className="text-orange-500 border-orange-500/30 hover:bg-orange-500/5"
              >
                Fix Weaknesses
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Auto-finish when time runs out
  if (timedOut && !finished) {
    finishSession();
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const answered = results.length > currentIndex;
  const progressPct = ((currentIndex + (answered ? 1 : 0)) / questions.length) * 100;
  const timerMinutes = Math.floor(timeRemaining / 60);
  const timerSeconds = timeRemaining % 60;
  const timerWarning = timeLimitMin > 0 && timeRemaining < 120;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tabular-nums">
            {currentIndex + 1}<span className="text-muted-foreground">/{questions.length}</span>
          </span>
          <Progress value={progressPct} className="w-32 sm:w-48 h-1.5" />
        </div>
        <div className="flex items-center gap-3">
          {timeLimitMin > 0 && (
            <span className={`text-sm font-mono font-bold tabular-nums ${timerWarning ? "text-red-500 animate-pulse" : "text-muted-foreground"}`}>
              {timerMinutes}:{timerSeconds.toString().padStart(2, "0")}
            </span>
          )}
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={finishSession}>
            End
          </Button>
        </div>
      </div>

      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        onHint={handleHint}
        onNext={handleNext}
        hintText={hintText}
        hintLoading={hintLoading}
      />
    </div>
  );
}
