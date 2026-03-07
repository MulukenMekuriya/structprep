"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";
import { TOPIC_SHORT_LABELS, TOPIC_WEIGHTS, NCEES_TOPICS } from "@/types";

export default function ExamPage() {
  const router = useRouter();

  async function startExam() {
    const res = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mock_exam" }),
    });

    if (!res.ok) return;
    const session = await res.json();
    router.push(`/exam/session?id=${session.id}`);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Mock Exam</h1>
        <p className="text-muted-foreground">
          Simulate the actual PE Civil: Structures CBT exam experience.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            PE Civil: Structures Mock Exam
          </CardTitle>
          <CardDescription>
            Matches the NCEES exam format and topic distribution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Questions</p>
              <p className="font-semibold">80 multiple choice</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time Limit</p>
              <p className="font-semibold">9 hours</p>
            </div>
            <div>
              <p className="text-muted-foreground">Topic Distribution</p>
              <p className="font-semibold">NCEES-weighted</p>
            </div>
            <div>
              <p className="text-muted-foreground">Difficulty</p>
              <p className="font-semibold">Mixed (Easy-Hard)</p>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Topic Distribution</p>
            {NCEES_TOPICS.map((topic) => (
              <div
                key={topic}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {TOPIC_SHORT_LABELS[topic]}
                </span>
                <Badge variant="outline">
                  ~{Math.round(TOPIC_WEIGHTS[topic] * 80)} questions
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              This is a timed exam. Once started, the timer runs continuously.
              You can flag questions and navigate freely. No hints or solutions
              until you submit.
            </p>
          </div>

          <Button size="lg" className="w-full" onClick={startExam}>
            Start Mock Exam
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
