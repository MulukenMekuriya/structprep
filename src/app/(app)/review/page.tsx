"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RotateCcw,
  Flag,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Trophy,
  Target,
  Flame,
  Brain,
} from "lucide-react";
import { TOPIC_LABELS, type NCEESTopic, type Question } from "@/types";
import { Markdown } from "@/components/ui/markdown";

interface ReviewData {
  due: (Question & {
    sr_data?: {
      ease_factor: string;
      interval_days: number;
      repetitions: number;
      next_review_at: string;
    };
  })[];
  flagged: Question[];
  total_due: number;
  total_flagged: number;
}

const DAILY_TARGET = 15;

export default function ReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"queue" | "session">("queue");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ is_correct: boolean }[]>([]);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reviewedToday, setReviewedToday] = useState(0);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/review/queue");
      if (!res.ok) throw new Error("Failed to fetch review queue");
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function startReviewSession(type: "due" | "flagged") {
    if (!data) return;

    const questionsToReview = type === "due" ? data.due : data.flagged;
    if (questionsToReview.length === 0) return;

    const res = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "review" }),
    });

    if (res.ok) {
      const session = await res.json();
      setSessionId(session.id);
    }

    setQuestions(questionsToReview);
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
    setFlipped(false);
    setSelectedOption(null);
    setSubmitted(false);
    setMode("session");
  }

  async function handleAnswer() {
    if (!selectedOption || !questions[currentIndex]) return;

    const question = questions[currentIndex];
    const isCorrect = selectedOption === question.correct_option_id;
    setSubmitted(true);
    setFlipped(true);

    if (sessionId) {
      try {
        await fetch(`/api/questions/${question.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_option_id: selectedOption,
            time_spent_sec: 0,
            flagged: false,
            hints_used: 0,
            session_id: sessionId,
          }),
        });
      } catch {
        // ignore
      }
    }

    setResults((prev) => [...prev, { is_correct: isCorrect }]);
    setReviewedToday((prev) => prev + 1);
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setSubmitted(false);
      setFlipped(false);
    } else {
      setFinished(true);
      if (sessionId) {
        fetch(`/api/sessions/${sessionId}`, { method: "PATCH" }).catch(() => {});
      }
    }
  }

  // Self-rating for SR quality — updates SM-2 intervals
  async function handleSelfRate(rating: "easy" | "good" | "hard" | "again") {
    const question = questions[currentIndex];
    if (!question) return;

    // Map rating to SM-2 quality score
    const qualityMap = { again: 1, hard: 3, good: 4, easy: 5 };
    const quality = qualityMap[rating];

    try {
      await fetch("/api/review/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: question.id, quality }),
      });
    } catch {
      // Non-critical — still advance
    }

    handleNext();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Finished review session
  if (mode === "session" && finished) {
    const correct = results.filter((r) => r.is_correct).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
            <CardTitle className="text-2xl">Review Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="text-5xl font-bold">{pct}%</div>
            <p className="text-muted-foreground">
              {correct} of {total} correct
            </p>
            <Progress value={pct} className="h-3" />

            {/* Review summary by confidence */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="rounded-lg border p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <div className="text-xl font-bold">{correct}</div>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <div className="text-xl font-bold">{total - correct}</div>
                <p className="text-xs text-muted-foreground">Need Review</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMode("queue");
                  fetchQueue();
                }}
              >
                Back to Queue
              </Button>
              <Button onClick={() => window.location.reload()}>
                Review Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active review session — card flip style
  if (mode === "session") {
    const question = questions[currentIndex];
    if (!question) return null;

    const isCorrect = selectedOption === question.correct_option_id;
    const progressPct =
      ((currentIndex + (submitted ? 1 : 0)) / questions.length) * 100;

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {/* Progress bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {questions.length}
            </span>
            <Progress value={progressPct} className="w-48 h-2" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              {reviewedToday}/{DAILY_TARGET} today
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMode("queue");
                fetchQueue();
              }}
            >
              End Review
            </Button>
          </div>
        </div>

        {/* Flashcard */}
        <div className="perspective-1000">
          <div
            className={`relative transition-transform duration-500 transform-style-3d ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            }`}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Front of card — Question */}
            <Card
              className={`${flipped ? "invisible" : ""}`}
              style={{ backfaceVisibility: "hidden" }}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {TOPIC_LABELS[question.topic as NCEESTopic] || question.topic}
                  </Badge>
                  <Badge
                    variant={
                      question.difficulty === "hard"
                        ? "destructive"
                        : question.difficulty === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {question.difficulty}
                  </Badge>
                  {("sr_data" in question) && (question as unknown as { sr_data: { repetitions: number } }).sr_data && (
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      <Brain className="h-3 w-3 mr-1" />
                      Rep #{(question as unknown as { sr_data: { repetitions: number } }).sr_data.repetitions}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 text-lg leading-relaxed font-semibold">
                  <Markdown>{question.question_text}</Markdown>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {question.options.map((option) => {
                  let optionStyle =
                    "border hover:border-primary/50 cursor-pointer";

                  if (submitted) {
                    if (option.id === question.correct_option_id) {
                      optionStyle =
                        "border-green-500 bg-green-50 dark:bg-green-950/30";
                    } else if (
                      option.id === selectedOption &&
                      option.id !== question.correct_option_id
                    ) {
                      optionStyle =
                        "border-red-500 bg-red-50 dark:bg-red-950/30";
                    } else {
                      optionStyle = "border opacity-50";
                    }
                  } else if (option.id === selectedOption) {
                    optionStyle = "border-primary bg-primary/5";
                  }

                  return (
                    <div
                      key={option.id}
                      className={`flex items-center gap-3 rounded-lg p-4 transition-colors ${optionStyle}`}
                      onClick={() => !submitted && setSelectedOption(option.id)}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-semibold text-sm">
                        {option.id}
                      </div>
                      <div className="text-sm flex-1">
                        <Markdown>{option.text}</Markdown>
                      </div>
                      {submitted &&
                        option.id === question.correct_option_id && (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        )}
                      {submitted &&
                        option.id === selectedOption &&
                        option.id !== question.correct_option_id && (
                          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        )}
                    </div>
                  );
                })}

                {/* Solution shown after submit */}
                {submitted && (
                  <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      {isCorrect ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {isCorrect ? "Correct!" : "Incorrect"}
                    </h3>
                    <Markdown>{question.solution_text}</Markdown>
                    {question.code_references.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {question.code_references.map((ref) => (
                          <Badge
                            key={ref}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-primary/10"
                            onClick={() => {
                              // Navigate to reference search with this citation
                              window.open(
                                `/references?q=${encodeURIComponent(ref)}`,
                                "_blank"
                              );
                            }}
                          >
                            {ref}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-between mt-4">
                  {!submitted ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFlipped(true)}
                      >
                        Show Answer
                      </Button>
                      <Button
                        onClick={handleAnswer}
                        disabled={!selectedOption}
                      >
                        Submit Answer
                      </Button>
                    </>
                  ) : (
                    <div className="w-full space-y-3">
                      <p className="text-xs text-muted-foreground text-center">
                        How well did you know this?
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => handleSelfRate("again")}
                        >
                          Again
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                          onClick={() => handleSelfRate("hard")}
                        >
                          Hard
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                          onClick={() => handleSelfRate("good")}
                        >
                          Good
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                          onClick={() => handleSelfRate("easy")}
                        >
                          Easy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Queue view
  const dailyProgress = Math.min(
    100,
    Math.round((reviewedToday / DAILY_TARGET) * 100)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Spaced Repetition Review</h1>
        <p className="text-muted-foreground">
          Questions scheduled for optimal review timing using the SM-2
          algorithm.
        </p>
      </div>

      {/* Daily Target */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-sm">Daily Target</span>
            </div>
            <div className="flex-1">
              <Progress value={dailyProgress} className="h-2.5" />
            </div>
            <span className="text-sm font-medium">
              {reviewedToday}/{DAILY_TARGET}
            </span>
          </div>
          {reviewedToday >= DAILY_TARGET && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Daily target reached! Great work.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Due for Review
            </CardTitle>
            <CardDescription>
              Questions scheduled by spaced repetition
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.total_due > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{data.total_due} questions</p>
                  <Badge variant="outline" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    SM-2
                  </Badge>
                </div>
                <Button
                  className="w-full"
                  onClick={() => startReviewSession("due")}
                >
                  Start Review
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">
                  All caught up! No questions due for review.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep practicing to build your review queue.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-500" />
              Flagged Questions
            </CardTitle>
            <CardDescription>
              Questions you flagged for later review
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.total_flagged > 0 ? (
              <div className="space-y-3">
                <p className="text-2xl font-bold">
                  {data.total_flagged} questions
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => startReviewSession("flagged")}
                >
                  Review Flagged
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <Flag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No flagged questions.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Flag questions during practice to review later.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How SR Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How Spaced Repetition Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div className="rounded-lg border p-3">
              <div className="font-bold text-red-500 mb-1">Again</div>
              <p className="text-muted-foreground">Review in 1 min</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="font-bold text-orange-500 mb-1">Hard</div>
              <p className="text-muted-foreground">Review in 1 day</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="font-bold text-green-500 mb-1">Good</div>
              <p className="text-muted-foreground">Review in 3 days</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="font-bold text-blue-500 mb-1">Easy</div>
              <p className="text-muted-foreground">Review in 7 days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
