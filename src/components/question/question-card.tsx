"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flag,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ChevronRight,
  HelpCircle,
  Loader2,
  Clock,
  BookOpen,
} from "lucide-react";
import { TOPIC_LABELS, type Question } from "@/types";
import { Markdown } from "@/components/ui/markdown";

interface QuestionCardProps {
  question: Question;
  questionNumber?: number;
  totalQuestions?: number;
  onAnswer: (optionId: string, timeSpent: number) => void;
  onFlag?: () => void;
  onHint?: (level: 1 | 2 | 3) => void;
  onExplain?: () => void;
  onNext?: () => void;
  showSolution?: boolean;
  hintText?: string | null;
  hintLoading?: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onFlag,
  onHint,
  onExplain,
  onNext,
  showSolution = false,
  hintText,
  hintLoading,
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const [whyWrong, setWhyWrong] = useState<{
    category: string;
    label: string;
    explanation: string;
    tip: string;
  } | null>(null);
  const [whyWrongLoading, setWhyWrongLoading] = useState(false);
  const solutionRef = useRef<HTMLDivElement>(null);

  const isCorrect = selectedOption === question.correct_option_id;

  // Live timer
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, startTime]);

  // Scroll to solution on submit
  useEffect(() => {
    if (submitted && solutionRef.current) {
      setTimeout(() => {
        solutionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [submitted]);

  function handleSubmit() {
    if (!selectedOption) return;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    setSubmitted(true);
    onAnswer(selectedOption, timeSpent);
  }

  function handleHint() {
    const level = Math.min(hintsUsed + 1, 3) as 1 | 2 | 3;
    setHintsUsed(level);
    onHint?.(level);
  }

  function handleFlag() {
    setFlagged(!flagged);
    onFlag?.();
  }

  async function handleWhyWrong() {
    if (whyWrong || whyWrongLoading || !selectedOption) return;
    setWhyWrongLoading(true);
    try {
      const res = await fetch(`/api/questions/${question.id}/why-wrong`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_option_id: selectedOption }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setWhyWrong(data);
    } catch {
      setWhyWrong({
        category: "other",
        label: "Analysis unavailable",
        explanation: "Could not classify the mistake.",
        tip: "Compare your approach with the solution step-by-step.",
      });
    } finally {
      setWhyWrongLoading(false);
    }
  }

  const difficultyColor = question.difficulty === "hard"
    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
    : question.difficulty === "medium"
      ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
      : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Card className="max-w-3xl mx-auto overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-normal">
            {TOPIC_LABELS[question.topic]}
          </Badge>
          <Badge variant="outline" className={`text-[11px] font-normal ${difficultyColor}`}>
            {question.difficulty}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(submitted ? Math.round((Date.now() - startTime) / 1000) : elapsed)}
          </span>
          <button
            onClick={handleFlag}
            className={`p-1.5 rounded-md transition-colors ${
              flagged
                ? "text-orange-500 bg-orange-500/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="px-5 pt-5 pb-3">
        <div className="text-base leading-relaxed font-medium">
          <Markdown>{question.question_text}</Markdown>
        </div>
      </div>

      <CardContent className="space-y-2 px-5">
        {/* Options */}
        {question.options.map((option) => {
          const isSelected = option.id === selectedOption;
          const isCorrectOption = option.id === question.correct_option_id;
          const isWrongSelection = isSelected && !isCorrectOption;

          let optionClasses = "border transition-all cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02]";
          let letterClasses = "border bg-background";

          if (submitted) {
            if (isCorrectOption) {
              optionClasses = "border-green-500 bg-green-500/5";
              letterClasses = "border-green-500 bg-green-500 text-white";
            } else if (isWrongSelection) {
              optionClasses = "border-red-500 bg-red-500/5";
              letterClasses = "border-red-500 bg-red-500 text-white";
            } else {
              optionClasses = "border-transparent opacity-40";
              letterClasses = "border-muted bg-muted";
            }
          } else if (isSelected) {
            optionClasses = "border-primary bg-primary/5 ring-1 ring-primary/20";
            letterClasses = "border-primary bg-primary text-primary-foreground";
          }

          return (
            <div
              key={option.id}
              className={`flex items-start gap-3 rounded-xl p-3.5 ${optionClasses}`}
              onClick={() => !submitted && setSelectedOption(option.id)}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${letterClasses}`}>
                {option.id}
              </div>
              <div className="text-sm flex-1 pt-0.5">
                <Markdown>{option.text}</Markdown>
              </div>
              {submitted && isCorrectOption && (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              )}
              {submitted && isWrongSelection && (
                <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              )}
            </div>
          );
        })}

        {/* Hint Panel */}
        {!submitted && (hintText || hintLoading) && (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <h3 className="font-semibold text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
              <Lightbulb className="h-3.5 w-3.5" />
              Hint · Level {hintsUsed}
            </h3>
            {hintLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating hint...
              </div>
            ) : (
              <div className="text-sm"><Markdown>{hintText || ""}</Markdown></div>
            )}
          </div>
        )}

        {/* Solution Panel */}
        {submitted && (
          <div ref={solutionRef} className="mt-3 rounded-xl border bg-muted/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              {isCorrect ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold text-sm">Correct!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span className="font-bold text-sm">Incorrect</span>
                </div>
              )}
            </div>
            <div className="text-sm leading-relaxed">
              <Markdown>{question.solution_text}</Markdown>
            </div>
            {question.code_references.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                {question.code_references.map((ref) => (
                  <Badge
                    key={ref}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() =>
                      window.open(
                        `/references?q=${encodeURIComponent(ref)}`,
                        "_blank"
                      )
                    }
                  >
                    {ref} ↗
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Why Wrong? Panel */}
        {submitted && !isCorrect && whyWrong && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
            <h3 className="font-semibold text-xs flex items-center gap-1.5 text-red-600 dark:text-red-400 uppercase tracking-wide">
              <HelpCircle className="h-3.5 w-3.5" />
              {whyWrong.label}
            </h3>
            <p className="text-sm">{whyWrong.explanation}</p>
            <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-600 dark:text-red-400">
              {whyWrong.category.replace(/_/g, " ")}
            </Badge>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tip:</span> {whyWrong.tip}
            </p>
          </div>
        )}
      </CardContent>

      {/* Footer Actions */}
      <CardFooter className="flex justify-between px-5 py-3 border-t bg-muted/20">
        <div className="flex gap-2">
          {!submitted && (
            <Button variant="ghost" size="sm" onClick={handleHint} className="text-xs h-8 gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Hint {hintsUsed > 0 && `(${hintsUsed}/3)`}
            </Button>
          )}
          {submitted && !isCorrect && !whyWrong && (
            <Button variant="ghost" size="sm" onClick={handleWhyWrong} disabled={whyWrongLoading} className="text-xs h-8 gap-1.5">
              {whyWrongLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HelpCircle className="h-3.5 w-3.5" />
              )}
              Why Wrong?
            </Button>
          )}
          {submitted && onExplain && (
            <Button variant="ghost" size="sm" onClick={onExplain} className="text-xs h-8 gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Full Explanation
            </Button>
          )}
        </div>
        <div>
          {!submitted ? (
            <Button
              onClick={handleSubmit}
              disabled={!selectedOption}
              size="sm"
              className="h-8 gap-1.5"
            >
              Submit
            </Button>
          ) : (
            onNext && (
              <Button onClick={onNext} size="sm" className="h-8 gap-1">
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
