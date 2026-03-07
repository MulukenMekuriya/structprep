"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QuestionCard } from "@/components/question/question-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Trophy } from "lucide-react";
import type { Question, StudySession } from "@/types";

interface AttemptResult {
  is_correct: boolean;
  correct_option_id: string;
}

export default function PracticeSessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topic = searchParams.get("topic");

  const [session, setSession] = useState<StudySession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

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
      const params = new URLSearchParams({ limit: "10" });
      if (topic) params.set("topic", topic);
      const questionsRes = await fetch(`/api/questions?${params}`);

      if (!questionsRes.ok) throw new Error("Failed to fetch questions");
      const questionsData = await questionsRes.json();

      if (questionsData.length === 0) {
        setError("No questions available for this topic yet.");
        return;
      }

      setQuestions(questionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [topic]);

  useEffect(() => {
    initSession();
  }, [initSession]);

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
          hints_used: 0,
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

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
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

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
            <CardTitle className="text-2xl">Session Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold">{pct}%</div>
              <p className="text-muted-foreground mt-1">
                {correct} of {total} correct
              </p>
            </div>

            <Progress value={pct} className="h-3" />

            <div className="space-y-2">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {results[i]?.is_correct ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                  <p className="text-sm flex-1 line-clamp-1">
                    {q.question_text}
                  </p>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {q.difficulty}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push("/practice")}>
                Back to Topics
              </Button>
              <Button onClick={() => window.location.reload()}>
                Practice Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const answered = results.length > currentIndex;
  const progressPct = ((currentIndex + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </span>
          <Progress value={progressPct} className="w-48 h-2" />
        </div>
        <Button variant="outline" size="sm" onClick={finishSession}>
          End Session
        </Button>
      </div>

      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        onNext={handleNext}
      />
    </div>
  );
}
