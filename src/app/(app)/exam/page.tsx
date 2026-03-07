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
        iconGradient="from-red-500 to-orange-500"
        title="Mock Exam"
        description="Simulate the full PE Civil: Structures exam experience"
      />

      <SectionHeader title="Exam details" />

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: FileText, iconColor: "from-blue-500 to-indigo-500", shadow: "shadow-blue-500/15", label: "Questions", value: "80", sublabel: "multiple choice" },
          { icon: Timer, iconColor: "from-orange-500 to-red-500", shadow: "shadow-orange-500/15", label: "Time Limit", value: "9 hrs", sublabel: "continuous" },
          { icon: BarChart3, iconColor: "from-violet-500 to-purple-500", shadow: "shadow-violet-500/15", label: "Distribution", value: "NCEES", sublabel: "weighted topics" },
          { icon: Gauge, iconColor: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-500/15", label: "Difficulty", value: "Mixed", sublabel: "easy to hard" },
        ].map(({ icon: Icon, iconColor, shadow, label, value, sublabel }) => (
          <div key={label} className="rounded-xl border bg-card p-4 hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${iconColor} shadow-md ${shadow}`}>
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        ))}
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

      <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4">
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-500/15 shrink-0">
            <AlertTriangle className="h-4 w-4 text-white" />
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

      <Button size="lg" className="w-full h-12 rounded-xl text-base font-semibold glow-primary" onClick={startExam}>
        Start Mock Exam
      </Button>
    </div>
  );
}
