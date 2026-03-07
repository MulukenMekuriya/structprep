"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NCEES_TOPICS, TOPIC_LABELS, TOPIC_WEIGHTS, type NCEESTopic } from "@/types";

export default function PracticePage() {
  const [selectedTopic, setSelectedTopic] = useState<NCEESTopic | "all">("all");

  function startPractice() {
    const params = new URLSearchParams();
    if (selectedTopic !== "all") params.set("topic", selectedTopic);
    window.location.href = `/practice/session?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Practice</h1>
        <p className="text-muted-foreground">
          Select a topic to practice, or study all topics with adaptive
          difficulty.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className={`cursor-pointer transition-colors hover:border-primary/50 ${
            selectedTopic === "all" ? "border-primary bg-primary/5" : ""
          }`}
          onClick={() => setSelectedTopic("all")}
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

        {NCEES_TOPICS.map((topic) => (
          <Card
            key={topic}
            className={`cursor-pointer transition-colors hover:border-primary/50 ${
              selectedTopic === topic ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => setSelectedTopic(topic)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {TOPIC_LABELS[topic]}
              </CardTitle>
              <CardDescription>
                {Math.round(TOPIC_WEIGHTS[topic] * 100)}% of exam
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                {Math.round(TOPIC_WEIGHTS[topic] * 80)} questions on exam
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={startPractice}>
          Start Practice Session
        </Button>
      </div>
    </div>
  );
}
