"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface TopicStat {
  topic: string;
  label: string;
  correct: number;
  total: number;
  accuracy: number;
  avgTimeSec: number;
}

interface SubtopicStat {
  name: string;
  topic: string;
  topicLabel: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface DifficultyStat {
  difficulty: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface WeeklyPoint {
  date: string;
  correct: number;
  total: number;
}

interface AnalyticsData {
  totalAttempted: number;
  totalCorrect: number;
  overallAccuracy: number;
  avgTimePerQuestion: number;
  topicBreakdown: TopicStat[];
  subtopicBreakdown: SubtopicStat[];
  difficultyBreakdown: DifficultyStat[];
  weeklyTrend: WeeklyPoint[];
  paceAnalysis: {
    avgTime: number;
    fastestTopic: TopicStat | null;
    slowestTopic: TopicStat | null;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.totalAttempted === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Start practicing to see your performance analytics here.
          </p>
        </div>
        <Card className="p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No data yet. Complete some practice questions to unlock analytics.</p>
        </Card>
      </div>
    );
  }

  const maxWeeklyTotal = Math.max(...data.weeklyTrend.map((w) => w.total), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Deep dive into your PE exam preparation progress
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overallAccuracy}%</div>
            <p className="text-xs text-muted-foreground">
              {data.totalCorrect}/{data.totalAttempted} correct
            </p>
            <Progress value={data.overallAccuracy} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time/Question</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(data.avgTimePerQuestion / 60)}m {data.avgTimePerQuestion % 60}s
            </div>
            <p className="text-xs text-muted-foreground">
              Target: ~6 min for PE exam
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fastest Topic</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {data.paceAnalysis.fastestTopic?.label || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.paceAnalysis.fastestTopic
                ? `${Math.floor(data.paceAnalysis.fastestTopic.avgTimeSec / 60)}m ${data.paceAnalysis.fastestTopic.avgTimeSec % 60}s avg`
                : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slowest Topic</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {data.paceAnalysis.slowestTopic?.label || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.paceAnalysis.slowestTopic
                ? `${Math.floor(data.paceAnalysis.slowestTopic.avgTimeSec / 60)}m ${data.paceAnalysis.slowestTopic.avgTimeSec % 60}s avg`
                : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
          <CardDescription>Questions attempted per week with accuracy</CardDescription>
        </CardHeader>
        <CardContent>
          {data.weeklyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Not enough data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.weeklyTrend.slice(-12).map((week) => {
                const accuracy = week.total > 0 ? Math.round((week.correct / week.total) * 100) : 0;
                const widthPct = Math.max((week.total / maxWeeklyTotal) * 100, 4);
                return (
                  <div key={week.date} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0 font-mono">
                      {new Date(week.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className={`h-6 rounded-sm flex items-center justify-end pr-2 text-xs font-medium text-white ${
                          accuracy >= 70 ? "bg-green-500" : accuracy >= 50 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${widthPct}%`, minWidth: "2rem" }}
                      >
                        {week.total}
                      </div>
                      <span className="text-xs text-muted-foreground">{accuracy}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Topic Accuracy */}
        <Card>
          <CardHeader>
            <CardTitle>Accuracy by Topic</CardTitle>
            <CardDescription>Performance across NCEES exam categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.topicBreakdown.map((t) => {
              const isWeak = t.total >= 3 && t.accuracy < 60;
              const isStrong = t.total >= 3 && t.accuracy >= 80;
              return (
                <div key={t.topic} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-1.5">
                      {isWeak && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                      {isStrong && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                      {t.label}
                    </span>
                    <span className="text-muted-foreground">
                      {t.total > 0 ? (
                        <>
                          {t.accuracy}% ({t.correct}/{t.total})
                        </>
                      ) : (
                        "No attempts"
                      )}
                    </span>
                  </div>
                  <Progress
                    value={t.total > 0 ? t.accuracy : 0}
                    className={`h-2 ${isWeak ? "[&>div]:bg-orange-500" : isStrong ? "[&>div]:bg-green-500" : ""}`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Topic Pace */}
        <Card>
          <CardHeader>
            <CardTitle>Pace by Topic</CardTitle>
            <CardDescription>Average time per question (target: ~6 min)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.topicBreakdown
              .filter((t) => t.total > 0)
              .sort((a, b) => b.avgTimeSec - a.avgTimeSec)
              .map((t) => {
                const minutes = Math.floor(t.avgTimeSec / 60);
                const seconds = t.avgTimeSec % 60;
                const isSlow = t.avgTimeSec > 420; // > 7 min
                const isFast = t.avgTimeSec < 240; // < 4 min
                const pct = Math.min((t.avgTimeSec / 600) * 100, 100); // 10min = 100%
                return (
                  <div key={t.topic} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{t.label}</span>
                      <span className={`font-mono ${isSlow ? "text-orange-500" : isFast ? "text-green-500" : "text-muted-foreground"}`}>
                        {minutes}m {seconds}s
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-2 ${isSlow ? "[&>div]:bg-orange-500" : isFast ? "[&>div]:bg-green-500" : ""}`}
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      {/* Difficulty Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Difficulty Breakdown</CardTitle>
          <CardDescription>Accuracy by question difficulty level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {data.difficultyBreakdown.map((d) => (
              <div key={d.difficulty} className="text-center space-y-2">
                <Badge
                  variant={
                    d.difficulty === "hard" ? "destructive" : d.difficulty === "medium" ? "default" : "secondary"
                  }
                  className="text-sm"
                >
                  {d.difficulty}
                </Badge>
                <div className="text-2xl font-bold">{d.accuracy}%</div>
                <p className="text-xs text-muted-foreground">
                  {d.correct}/{d.total} correct
                </p>
                <Progress value={d.accuracy} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subtopic Breakdown */}
      {data.subtopicBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subtopic Performance</CardTitle>
            <CardDescription>
              Detailed accuracy by subtopic (2+ attempts shown)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.subtopicBreakdown.map((s) => {
                const isWeak = s.accuracy < 50;
                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isWeak && <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <p className="text-sm font-medium truncate">{s.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.topicLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isWeak ? "text-red-500" : ""}`}>
                        {s.accuracy}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.correct}/{s.total}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
