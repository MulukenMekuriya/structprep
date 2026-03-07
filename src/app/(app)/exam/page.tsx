"use client";

import { useRouter } from "next/navigation";
// Card components removed — using custom gradient cards instead
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, FileText, Timer, BarChart3, Gauge } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
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
      <PageHeader
        icon={<Clock className="h-6 w-6" />}
        iconGradient="from-red-500/10 to-orange-500/10"
        iconAccent="text-red-600 dark:text-red-400"
        title="Mock Exam"
        description="Simulate the full PE Civil: Structures exam experience"
      />

      <SectionHeader title="Exam details" />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-gradient-to-br from-blue-500/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Questions</span>
          </div>
          <p className="text-2xl font-bold">80</p>
          <p className="text-xs text-muted-foreground">multiple choice</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-orange-500/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time Limit</span>
          </div>
          <p className="text-2xl font-bold">9 hrs</p>
          <p className="text-xs text-muted-foreground">continuous</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-violet-500/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distribution</span>
          </div>
          <p className="text-2xl font-bold">NCEES</p>
          <p className="text-xs text-muted-foreground">weighted topics</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Difficulty</span>
          </div>
          <p className="text-2xl font-bold">Mixed</p>
          <p className="text-xs text-muted-foreground">easy to hard</p>
        </div>
      </div>

      <SectionHeader title="Topic distribution" />

      <div className="rounded-xl border bg-gradient-to-br from-muted/30 to-transparent p-4 space-y-2.5">
        {NCEES_TOPICS.map((topic) => (
          <div
            key={topic}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">
              {TOPIC_SHORT_LABELS[topic]}
            </span>
            <Badge variant="outline" className="rounded-lg">
              ~{Math.round(TOPIC_WEIGHTS[topic] * 80)} questions
            </Badge>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-0.5">Timed Exam</p>
            <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
              Once started, the timer runs continuously.
              You can flag questions and navigate freely. No hints or solutions
              until you submit.
            </p>
          </div>
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={startExam}>
        Start Mock Exam
      </Button>
    </div>
  );
}
