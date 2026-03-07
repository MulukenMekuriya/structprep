"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    window.location.href = `/practice/session?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Practice</h1>
        <p className="text-muted-foreground">
          Select a topic or subtopic to practice, or study all topics with
          adaptive difficulty.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className={`cursor-pointer transition-colors hover:border-primary/50 ${
            selection.type === "all" ? "border-primary bg-primary/5" : ""
          }`}
          onClick={() => setSelection({ type: "all" })}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Topics</CardTitle>
            <CardDescription>
              Adaptive mix weighted to NCEES exam distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">100%</Badge>
          </CardContent>
        </Card>

        {NCEES_TOPICS.map((topic) => {
          const expanded = isTopicSelected(topic);
          const subtopics = TOPIC_SUBTOPICS[topic];

          return (
            <Card
              key={topic}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                expanded ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleTopicClick(topic)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {TOPIC_LABELS[topic]}
                </CardTitle>
                <CardDescription>
                  {Math.round(TOPIC_WEIGHTS[topic] * 100)}% of exam
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="secondary">
                  {Math.round(TOPIC_WEIGHTS[topic] * 80)} questions on exam
                </Badge>

                {expanded && (
                  <ul className="space-y-1 pt-1">
                    {subtopics.map((sub) => (
                      <li
                        key={sub}
                        className={`rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-primary/10 ${
                          isSubtopicSelected(topic, sub)
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground"
                        }`}
                        onClick={(e) => handleSubtopicClick(e, topic, sub)}
                      >
                        {sub}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={startPractice}>
          {selection.type === "subtopic"
            ? `Practice: ${selection.subtopic}`
            : selection.type === "topic"
              ? `Practice: ${TOPIC_LABELS[selection.topic]}`
              : "Start Practice Session"}
        </Button>
      </div>
    </div>
  );
}
