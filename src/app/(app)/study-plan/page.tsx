"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Calendar,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Brain,
  RotateCcw,
  FileText,
  Sparkles,
} from "lucide-react";

interface Activity {
  activity: string;
  duration: string;
  topic: string;
  type: "learn" | "practice" | "review" | "exam";
}

interface DaySchedule {
  day: string;
  hours: number;
  activities: Activity[];
}

interface PriorityTopic {
  topic: string;
  reason: string;
  targetAccuracy: number;
}

interface Milestone {
  week: number;
  goal: string;
}

interface StudyPlan {
  summary: string;
  weeklySchedule: DaySchedule[];
  priorityTopics: PriorityTopic[];
  milestones: Milestone[];
  examReadiness: {
    currentScore: number;
    targetScore: number;
    onTrack: boolean;
    recommendation: string;
  };
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  learn: <BookOpen className="h-3.5 w-3.5" />,
  practice: <Brain className="h-3.5 w-3.5" />,
  review: <RotateCcw className="h-3.5 w-3.5" />,
  exam: <FileText className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
  learn: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  practice: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  review: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  exam: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export default function StudyPlanPage() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoursPerWeek }),
      });

      if (!res.ok) throw new Error("Failed to generate plan");

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Initial state — show generate form
  if (!plan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI Study Plan</h1>
          <p className="text-muted-foreground">
            Get a personalized weekly study schedule based on your performance and exam date
          </p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Your Study Plan
            </CardTitle>
            <CardDescription>
              The AI analyzes your practice history, weak areas, and time until the exam
              to create an optimized study schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Available study hours per week
              </label>
              <Input
                type="number"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 10-15 hours/week for PE exam prep
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button onClick={generatePlan} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating plan (takes ~10s)...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Study Plan
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Plan generated
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Study Plan</h1>
          <p className="text-muted-foreground">
            Personalized for {hoursPerWeek} hours/week
          </p>
        </div>
        <Button variant="outline" onClick={() => setPlan(null)}>
          Regenerate
        </Button>
      </div>

      {/* Readiness Score */}
      <Card className={plan.examReadiness.onTrack ? "border-green-500/30" : "border-orange-500/30"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {plan.examReadiness.onTrack ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            )}
            Exam Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{plan.examReadiness.currentScore}%</div>
              <p className="text-xs text-muted-foreground">Current</p>
            </div>
            <div className="flex-1">
              <Progress value={plan.examReadiness.currentScore} className="h-3" />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">0%</span>
                <span className="text-xs font-medium text-green-600">70% passing</span>
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
            </div>
          </div>
          <p className="text-sm">{plan.examReadiness.recommendation}</p>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm leading-relaxed">{plan.summary}</p>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>Your optimized study timetable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {plan.weeklySchedule.map((day) => (
              <div key={day.day} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{day.day}</h3>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {day.hours}h
                  </Badge>
                </div>
                <div className="space-y-2">
                  {day.activities.map((act, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <Badge
                        className={`shrink-0 text-[10px] gap-1 ${TYPE_COLORS[act.type] || TYPE_COLORS.learn}`}
                      >
                        {TYPE_ICONS[act.type] || TYPE_ICONS.learn}
                        {act.type}
                      </Badge>
                      <div className="flex-1">
                        <p>{act.activity}</p>
                        <p className="text-xs text-muted-foreground">
                          {act.topic} &middot; {act.duration}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Priority Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Priority Topics
            </CardTitle>
            <CardDescription>Focus areas for maximum improvement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.priorityTopics.map((pt) => (
              <div key={pt.topic} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{pt.topic}</h4>
                  <Badge variant="outline" className="text-xs">
                    Target: {pt.targetAccuracy}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{pt.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Milestones
            </CardTitle>
            <CardDescription>Goals to track your progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.milestones.map((m) => (
                <div key={m.week} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                    W{m.week}
                  </div>
                  <p className="text-sm pt-1">{m.goal}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Badge className={`text-[10px] gap-1 ${TYPE_COLORS.learn}`}>
            {TYPE_ICONS.learn} learn
          </Badge>
          New concepts
        </span>
        <span className="flex items-center gap-1">
          <Badge className={`text-[10px] gap-1 ${TYPE_COLORS.practice}`}>
            {TYPE_ICONS.practice} practice
          </Badge>
          Problem solving
        </span>
        <span className="flex items-center gap-1">
          <Badge className={`text-[10px] gap-1 ${TYPE_COLORS.review}`}>
            {TYPE_ICONS.review} review
          </Badge>
          Spaced review
        </span>
        <span className="flex items-center gap-1">
          <Badge className={`text-[10px] gap-1 ${TYPE_COLORS.exam}`}>
            {TYPE_ICONS.exam} exam
          </Badge>
          Mock exam
        </span>
      </div>
    </div>
  );
}
