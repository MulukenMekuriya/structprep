"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flag,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { TOPIC_LABELS, type Question } from "@/types";

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
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [flagged, setFlagged] = useState(false);

  const isCorrect = selectedOption === question.correct_option_id;

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

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {questionNumber && totalQuestions && (
              <span className="text-sm text-muted-foreground">
                Question {questionNumber} of {totalQuestions}
              </span>
            )}
            <Badge variant="outline">{TOPIC_LABELS[question.topic]}</Badge>
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
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFlag}
            className={flagged ? "text-orange-500" : ""}
          >
            <Flag className="h-4 w-4 mr-1" />
            {flagged ? "Flagged" : "Flag"}
          </Button>
        </div>
        <CardTitle className="text-lg leading-relaxed mt-2">
          {question.question_text}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {question.options.map((option) => {
          let optionStyle = "border hover:border-primary/50 cursor-pointer";

          if (submitted) {
            if (option.id === question.correct_option_id) {
              optionStyle =
                "border-green-500 bg-green-50 dark:bg-green-950/30";
            } else if (
              option.id === selectedOption &&
              option.id !== question.correct_option_id
            ) {
              optionStyle = "border-red-500 bg-red-50 dark:bg-red-950/30";
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
              <p className="text-sm flex-1">{option.text}</p>
              {submitted && option.id === question.correct_option_id && (
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

        {/* Solution Panel */}
        {submitted && (showSolution || true) && (
          <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {isCorrect ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              {isCorrect ? "Correct!" : "Incorrect"}
            </h3>
            <div className="text-sm whitespace-pre-wrap">
              {question.solution_text}
            </div>
            {question.code_references.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {question.code_references.map((ref) => (
                  <Badge key={ref} variant="outline" className="text-xs">
                    {ref}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {!submitted && (
            <Button variant="outline" size="sm" onClick={handleHint}>
              <Lightbulb className="h-4 w-4 mr-1" />
              Hint ({hintsUsed}/3)
            </Button>
          )}
          {submitted && onExplain && (
            <Button variant="outline" size="sm" onClick={onExplain}>
              AI Explanation
            </Button>
          )}
        </div>
        <div>
          {!submitted ? (
            <Button onClick={handleSubmit} disabled={!selectedOption}>
              Submit Answer
            </Button>
          ) : (
            onNext && (
              <Button onClick={onNext}>
                Next Question
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
