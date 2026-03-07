"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Hash, Play, Shuffle, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import {
  NCEES_TOPICS,
  TOPIC_LABELS,
  TOPIC_WEIGHTS,
  TOPIC_SUBTOPICS,
  type NCEESTopic,
} from "@/types";

type Selection =
  | { type: "all" }
  | { type: "topic"; topic: NCEESTopic }
  | { type: "subtopic"; topic: NCEESTopic; subtopic: string };

export default function PracticePage() {
  const [selection, setSelection] = useState<Selection>({ type: "all" });
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(0);

  function isTopicSelected(topic: NCEESTopic) {
    return (
      (selection.type === "topic" && selection.topic === topic) ||
      (selection.type === "subtopic" && selection.topic === topic)
    );
  }

  function isSubtopicSelected(topic: NCEESTopic, subtopic: string) {
    return (
      selection.type === "subtopic" &&
      selection.topic === topic &&
      selection.subtopic === subtopic
    );
  }

  function handleTopicClick(topic: NCEESTopic) {
    if (isTopicSelected(topic)) {
      setSelection({ type: "all" });
    } else {
      setSelection({ type: "topic", topic });
    }
  }

  function handleSubtopicClick(
    e: React.MouseEvent,
    topic: NCEESTopic,
    subtopic: string
  ) {
    e.stopPropagation();
    if (isSubtopicSelected(topic, subtopic)) {
      setSelection({ type: "topic", topic });
    } else {
      setSelection({ type: "subtopic", topic, subtopic });
    }
  }

  function startPractice() {
    const params = new URLSearchParams();
    if (selection.type === "topic") {
      params.set("topic", selection.topic);
    } else if (selection.type === "subtopic") {
      params.set("topic", selection.topic);
      params.set("subtopic", selection.subtopic);
    }
    params.set("count", String(questionCount));
    if (timeLimit > 0) {
      params.set("time", String(timeLimit));
    }
    window.location.href = `/practice/session?${params.toString()}`;
  }

  const selectionLabel = selection.type === "subtopic"
    ? selection.subtopic
    : selection.type === "topic"
      ? TOPIC_LABELS[selection.topic]
      : "All Topics";

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <PageHeader
        icon={<BookOpen className="h-6 w-6" />}
        iconGradient="from-blue-500 to-indigo-600"
        title="Practice"
        description="Build your skills with targeted question sets"
      />

      {/* Topic Selection */}
      <SectionHeader title="Select topics" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {/* All Topics Card */}
        <Card
          className={`cursor-pointer rounded-xl border transition-all hover-lift ${
            selection.type === "all"
              ? "border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-md shadow-primary/5"
              : "bg-gradient-to-br from-muted/30 to-transparent hover:border-primary/20"
          }`}
          onClick={() => setSelection({ type: "all" })}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/15">
                <Shuffle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold">All Topics</p>
                <p className="text-xs text-muted-foreground">
                  Adaptive mix · NCEES weighted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Topic Cards */}
        {NCEES_TOPICS.map((topic) => {
          const expanded = isTopicSelected(topic);
          const subtopics = TOPIC_SUBTOPICS[topic];
          const weight = Math.round(TOPIC_WEIGHTS[topic] * 100);
          const examQs = Math.round(TOPIC_WEIGHTS[topic] * 80);

          return (
            <Card
              key={topic}
              className={`cursor-pointer rounded-xl border transition-all hover-lift ${
                expanded
                  ? "border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-md shadow-primary/5"
                  : "bg-gradient-to-br from-muted/30 to-transparent hover:border-primary/20"
              }`}
              onClick={() => handleTopicClick(topic)}
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight">
                      {TOPIC_LABELS[topic]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {weight}% of exam · ~{examQs} questions
                    </p>
                  </div>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </div>

                {expanded && (
                  <div className="space-y-0.5 pt-1 border-t">
                    {subtopics.map((sub) => (
                      <div
                        key={sub}
                        className={`rounded-md px-2.5 py-1.5 text-sm transition-colors cursor-pointer ${
                          isSubtopicSelected(topic, sub)
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={(e) => handleSubtopicClick(e, topic, sub)}
                      >
                        {sub}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-5xl">
        <div className="rounded-2xl border glass shadow-xl shadow-black/5 dark:shadow-black/20 px-5 py-4">
          <SectionHeader title="Session settings" />
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Config */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-1">
                  {[5, 10, 15, 20, 30].map((n) => (
                    <Button
                      key={n}
                      variant={questionCount === n ? "default" : "ghost"}
                      size="sm"
                      className="h-7 w-8 text-xs"
                      onClick={() => setQuestionCount(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-1">
                  {[
                    { label: "No limit", value: 0 },
                    { label: "30m", value: 30 },
                    { label: "60m", value: 60 },
                    { label: "90m", value: 90 },
                  ].map(({ label, value }) => (
                    <Button
                      key={value}
                      variant={timeLimit === value ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setTimeLimit(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Start Button */}
            <Button size="lg" onClick={startPractice} className="gap-2 shrink-0 w-full sm:w-auto rounded-xl glow-primary">
              <Play className="h-4 w-4" />
              {selectionLabel}
              <Badge variant="secondary" className="text-[10px] ml-1">
                {questionCount}q{timeLimit > 0 ? ` · ${timeLimit}m` : ""}
              </Badge>
            </Button>
          </div>
          {timeLimit > 0 && (
            <p className="text-[10px] text-muted-foreground text-center sm:text-left mt-1">
              {Math.round(timeLimit / questionCount * 60)}s per question —{" "}
              {(timeLimit / questionCount) < 6 ? "faster than exam pace!" : "at exam pace"}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
