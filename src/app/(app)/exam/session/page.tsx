"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Flag,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
} from "lucide-react";
import { TOPIC_LABELS, type NCEESTopic, type Question } from "@/types";
import { Markdown } from "@/components/ui/markdown";

const EXAM_DURATION_SEC = 9 * 60 * 60; // 9 hours

export default function ExamSessionWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ExamSessionPage />
    </Suspense>
  );
}

interface ExamAnswer {
  optionId: string | null;
  flagged: boolean;
  timeSpent: number;
}

function ExamSessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("id");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<
    { is_correct: boolean; correct_option_id: string }[]
  >([]);
  const [timeRemaining, setTimeRemaining] = useState(EXAM_DURATION_SEC);
  const [showNav, setShowNav] = useState(false);
  const questionStartTime = useRef(Date.now());

  const loadQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/questions/exam");
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();

      if (data.length === 0) {
        setError("Not enough questions available for a mock exam.");
        return;
      }

      setQuestions(data);
      setAnswers(data.map(() => ({ optionId: null, flagged: false, timeSpent: 0 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionId) loadQuestions();
  }, [sessionId, loadQuestions]);

  // Timer
  useEffect(() => {
    if (loading || submitted || questions.length === 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, submitted, questions.length]);

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function selectOption(optionId: string) {
    if (submitted) return;
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], optionId };
      return updated;
    });
  }

  function toggleFlag() {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        flagged: !updated[currentIndex].flagged,
      };
      return updated;
    });
  }

  function navigateTo(index: number) {
    // Record time spent on current question
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        timeSpent: updated[currentIndex].timeSpent + elapsed,
      };
      return updated;
    });

    setCurrentIndex(index);
    questionStartTime.current = Date.now();
    setShowNav(false);
  }

  async function handleSubmitExam() {
    if (submitted) return;
    setSubmitted(true);

    // Record final time on current question
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
    const finalAnswers = [...answers];
    finalAnswers[currentIndex] = {
      ...finalAnswers[currentIndex],
      timeSpent: finalAnswers[currentIndex].timeSpent + elapsed,
    };
    setAnswers(finalAnswers);

    // Submit all answers
    const resultList: { is_correct: boolean; correct_option_id: string }[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = finalAnswers[i];

      if (a.optionId) {
        try {
          const res = await fetch(`/api/questions/${q.id}/attempt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selected_option_id: a.optionId,
              time_spent_sec: a.timeSpent,
              flagged: a.flagged,
              hints_used: 0,
              session_id: sessionId,
            }),
          });
          const result = await res.json();
          resultList.push({
            is_correct: result.is_correct,
            correct_option_id: result.correct_option_id || q.correct_option_id,
          });
        } catch {
          resultList.push({
            is_correct: a.optionId === q.correct_option_id,
            correct_option_id: q.correct_option_id,
          });
        }
      } else {
        resultList.push({
          is_correct: false,
          correct_option_id: q.correct_option_id,
        });
      }
    }

    setResults(resultList);

    // Finalize session
    if (sessionId) {
      try {
        await fetch(`/api/sessions/${sessionId}`, { method: "PATCH" });
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
        <Button onClick={() => router.push("/exam")}>Back to Exam</Button>
      </div>
    );
  }

  // Results screen
  if (submitted && results.length > 0) {
    const correct = results.filter((r) => r.is_correct).length;
    const total = results.length;
    const pct = Math.round((correct / total) * 100);
    const answered = answers.filter((a) => a.optionId !== null).length;
    const flaggedCount = answers.filter((a) => a.flagged).length;
    const timeUsed = EXAM_DURATION_SEC - timeRemaining;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
            <CardTitle className="text-2xl">Mock Exam Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold">{pct}%</div>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {correct}/{total}
                </div>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div>
                <div className="text-3xl font-bold">{answered}</div>
                <p className="text-sm text-muted-foreground">Answered</p>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {formatTime(timeUsed)}
                </div>
                <p className="text-sm text-muted-foreground">Time Used</p>
              </div>
            </div>

            <Progress value={pct} className="h-3" />

            <p className="text-center text-sm text-muted-foreground">
              {pct >= 70
                ? "Passing score! Keep up the great work."
                : "Below passing threshold (70%). Review your weak areas and keep practicing."}
            </p>

            {/* Per-question review */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="text-sm font-mono text-muted-foreground w-8">
                    {i + 1}
                  </span>
                  {results[i]?.is_correct ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                  <p className="text-sm flex-1 line-clamp-1">
                    {q.question_text}
                  </p>
                  {answers[i]?.flagged && (
                    <Flag className="h-4 w-4 text-orange-500 shrink-0" />
                  )}
                  <Badge variant="outline" className="text-xs shrink-0">
                    {q.difficulty}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
              <Button onClick={() => router.push("/exam")}>
                Take Another Exam
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active exam
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const answeredCount = answers.filter((a) => a.optionId !== null).length;
  const flaggedCount = answers.filter((a) => a.flagged).length;
  const currentAnswer = answers[currentIndex];
  const isTimeWarning = timeRemaining < 3600; // Less than 1 hour

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar: timer + progress */}
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {answeredCount} answered &middot; {flaggedCount} flagged
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1 font-mono text-sm font-bold ${
              isTimeWarning ? "text-red-500" : "text-muted-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            {formatTime(timeRemaining)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNav(!showNav)}
          >
            Navigator
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Submit your exam? You cannot change answers after submission.")) {
                handleSubmitExam();
              }
            }}
          >
            Submit Exam
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Question area */}
        <div className="flex-1 overflow-y-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {TOPIC_LABELS[currentQuestion.topic as NCEESTopic] ||
                      currentQuestion.topic}
                  </Badge>
                  <Badge
                    variant={
                      currentQuestion.difficulty === "hard"
                        ? "destructive"
                        : currentQuestion.difficulty === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {currentQuestion.difficulty}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFlag}
                  className={currentAnswer.flagged ? "text-orange-500" : ""}
                >
                  <Flag className="h-4 w-4 mr-1" />
                  {currentAnswer.flagged ? "Flagged" : "Flag"}
                </Button>
              </div>
              <div className="mt-2 text-lg leading-relaxed font-semibold">
                <Markdown>{currentQuestion.question_text}</Markdown>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQuestion.options.map((option) => {
                let optionStyle =
                  "border hover:border-primary/50 cursor-pointer";
                if (option.id === currentAnswer.optionId) {
                  optionStyle = "border-primary bg-primary/5";
                }

                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-3 rounded-lg p-4 transition-colors ${optionStyle}`}
                    onClick={() => selectOption(option.id)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-semibold text-sm">
                      {option.id}
                    </div>
                    <div className="text-sm flex-1"><Markdown>{option.text}</Markdown></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-4 pb-4">
            <Button
              variant="outline"
              onClick={() => navigateTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              onClick={() =>
                navigateTo(
                  currentIndex < questions.length - 1
                    ? currentIndex + 1
                    : currentIndex
                )
              }
              disabled={currentIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Question navigator panel */}
        {showNav && (
          <div className="w-64 shrink-0 overflow-y-auto border rounded-lg p-3">
            <p className="text-sm font-medium mb-3">Question Navigator</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((_, i) => {
                const a = answers[i];
                let bg = "bg-muted";
                if (i === currentIndex) bg = "ring-2 ring-primary bg-primary/10";
                else if (a.flagged && a.optionId)
                  bg = "bg-orange-100 dark:bg-orange-950";
                else if (a.flagged) bg = "bg-orange-50 dark:bg-orange-950/50";
                else if (a.optionId) bg = "bg-green-100 dark:bg-green-950";

                return (
                  <button
                    key={i}
                    className={`h-8 w-full rounded text-xs font-medium ${bg} hover:opacity-80`}
                    onClick={() => navigateTo(i)}
                  >
                    {i + 1}
                    {a.flagged && (
                      <Flag className="h-2.5 w-2.5 inline ml-0.5 text-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-100 dark:bg-green-950" />
                Answered
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-orange-100 dark:bg-orange-950" />
                Flagged
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-muted" />
                Unanswered
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
