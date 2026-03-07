"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Zap,
  CheckCircle2,
  XCircle,
  Trophy,
  Timer,
  BookOpen,
  RotateCcw,
  Target,
  Clock,
} from "lucide-react";
import { PageHeader, SectionHeader, StatCard } from "@/components/ui/page-header";
import {
  WHICH_CODE_SCENARIOS,
  type WhichCodeScenario,
} from "@/lib/data/which-code-scenarios";

const TIME_LIMIT = 30; // seconds per question

interface DrillResult {
  scenario: WhichCodeScenario;
  selectedCode: string;
  correct: boolean;
  timeTaken: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WhichCodeDrillPage() {
  const [mode, setMode] = useState<"intro" | "drill" | "results">("intro");
  const [scenarios, setScenarios] = useState<WhichCodeScenario[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DrillResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (mode !== "drill" || revealed) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — auto-reveal
          stopTimer();
          setRevealed(true);
          const scenario = scenarios[currentIndex];
          setResults((r) => [
            ...r,
            {
              scenario,
              selectedCode: selected || "No answer",
              correct: false,
              timeTaken: TIME_LIMIT,
            },
          ]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stopTimer();
  }, [mode, currentIndex, revealed, stopTimer, scenarios, selected]);

  function startDrill() {
    let filtered = WHICH_CODE_SCENARIOS;
    if (difficulty !== "all") {
      filtered = filtered.filter((s) => s.difficulty === difficulty);
    }
    const shuffled = shuffle(filtered).slice(0, 15); // 15 questions per drill
    setScenarios(shuffled);
    setCurrentIndex(0);
    setResults([]);
    setTimeLeft(TIME_LIMIT);
    setSelected(null);
    setRevealed(false);
    startTimeRef.current = Date.now();
    setMode("drill");
  }

  function handleSelect(code: string) {
    if (revealed) return;
    setSelected(code);
    setRevealed(true);
    stopTimer();

    const scenario = scenarios[currentIndex];
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    const correct = code === scenario.correctCode;

    setResults((r) => [...r, { scenario, selectedCode: code, correct, timeTaken }]);
  }

  function handleNext() {
    if (currentIndex < scenarios.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      setTimeLeft(TIME_LIMIT);
      startTimeRef.current = Date.now();
    } else {
      setMode("results");
    }
  }

  // ===== INTRO =====
  if (mode === "intro") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          icon={<Zap className="h-6 w-6" />}
          iconGradient="from-amber-500/10 to-yellow-500/10"
          iconAccent="text-amber-600 dark:text-amber-400"
          title="Which Code?"
          description="Test your knowledge of which code governs each scenario"
        />

        <Card>
          <CardHeader>
            <SectionHeader title="How It Works" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You&apos;ll see a problem description. Your job is to identify <strong>which code book</strong> you&apos;d reach for — not solve the problem.</p>
            <p>You have <strong>{TIME_LIMIT} seconds</strong> per question. Speed matters on exam day.</p>
            <p>After answering, you&apos;ll see the correct code and specific section reference.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader title="Difficulty" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {(["all", "easy", "medium", "hard"] as const).map((d) => {
                const isActive = difficulty === d;
                const colorMap = {
                  all: "hover:border-primary/50",
                  easy: "hover:border-green-500/50",
                  medium: "hover:border-yellow-500/50",
                  hard: "hover:border-red-500/50",
                };
                const activeColorMap = {
                  all: "",
                  easy: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",
                  medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
                  hard: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
                };
                return (
                  <Button
                    key={d}
                    variant={isActive && d === "all" ? "default" : "outline"}
                    size="sm"
                    className={`transition-all ${!isActive ? colorMap[d] : ""} ${isActive && d !== "all" ? activeColorMap[d] : ""}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d === "all" ? "All Levels" : d.charAt(0).toUpperCase() + d.slice(1)}
                    {d !== "all" && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {WHICH_CODE_SCENARIOS.filter((s) => s.difficulty === d).length}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full group" onClick={startDrill}>
          <Zap className="h-5 w-5 mr-2 transition-transform group-hover:scale-110" />
          Start Drill ({difficulty === "all"
            ? Math.min(15, WHICH_CODE_SCENARIOS.length)
            : Math.min(15, WHICH_CODE_SCENARIOS.filter((s) => s.difficulty === difficulty).length)} questions)
        </Button>
      </div>
    );
  }

  // ===== RESULTS =====
  if (mode === "results") {
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgTime = total > 0 ? Math.round(results.reduce((s, r) => s + r.timeTaken, 0) / total) : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          icon={<Trophy className="h-6 w-6" />}
          iconGradient="from-amber-500/10 to-yellow-500/10"
          iconAccent="text-amber-600 dark:text-amber-400"
          title="Drill Complete"
          description={`You answered ${correct} of ${total} correctly`}
        />

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<Target className="h-4 w-4" />}
            iconColor="text-amber-500"
            label="Accuracy"
            value={`${pct}%`}
            gradient="from-amber-500/5 to-transparent"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            iconColor="text-green-500"
            label="Correct"
            value={`${correct}/${total}`}
            gradient="from-green-500/5 to-transparent"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            iconColor="text-blue-500"
            label="Avg Time"
            value={`${avgTime}s`}
            gradient="from-blue-500/5 to-transparent"
          />
        </div>

        <Card>
          <CardHeader>
            <SectionHeader title="Question Breakdown" />
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  r.correct
                    ? "border-green-500/20 bg-green-500/5 dark:border-green-500/15 dark:bg-green-500/5"
                    : "border-red-500/20 bg-red-500/5 dark:border-red-500/15 dark:bg-red-500/5"
                }`}
              >
                {r.correct ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-1">{r.scenario.problem}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {r.scenario.correctCode} {r.scenario.correctSection}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{r.timeTaken}s</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => setMode("intro")}>
            Back
          </Button>
          <Button className="group" onClick={startDrill}>
            <RotateCcw className="h-4 w-4 mr-1 transition-transform group-hover:-rotate-180" />
            Drill Again
          </Button>
        </div>
      </div>
    );
  }

  // ===== DRILL MODE =====
  const scenario = scenarios[currentIndex];
  if (!scenario) return null;

  const progressPct = ((currentIndex + (revealed ? 1 : 0)) / scenarios.length) * 100;
  const timerPct = (timeLeft / TIME_LIMIT) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {scenarios.length}
          </span>
          <Progress value={progressPct} className="w-32 h-2" />
        </div>
        <div className="flex items-center gap-2">
          <Timer className={`h-4 w-4 ${timeLeft <= 10 ? "text-red-500" : "text-muted-foreground"}`} />
          <span className={`text-sm font-mono font-bold ${timeLeft <= 10 ? "text-red-500" : ""}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Timer bar */}
      <Progress
        value={timerPct}
        className={`h-1 ${timeLeft <= 10 ? "[&>div]:bg-red-500" : ""}`}
      />

      {/* Problem */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">{scenario.topic}</Badge>
            <Badge
              variant={
                scenario.difficulty === "hard"
                  ? "destructive"
                  : scenario.difficulty === "medium"
                    ? "default"
                    : "secondary"
              }
              className="text-xs"
            >
              {scenario.difficulty}
            </Badge>
          </div>
          <CardTitle className="text-lg leading-relaxed">
            {scenario.problem}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            Which code book do you reach for?
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Code options */}
          <div className="grid grid-cols-2 gap-3">
            {scenario.options.map((code) => {
              let style = "border hover:border-primary/50 cursor-pointer";
              if (revealed) {
                if (code === scenario.correctCode) {
                  style = "border-green-500 bg-green-50 dark:bg-green-950/30";
                } else if (code === selected && code !== scenario.correctCode) {
                  style = "border-red-500 bg-red-50 dark:bg-red-950/30";
                } else {
                  style = "border opacity-40";
                }
              } else if (code === selected) {
                style = "border-primary bg-primary/5";
              }

              return (
                <div
                  key={code}
                  className={`flex items-center gap-3 rounded-lg p-4 transition-colors ${style}`}
                  onClick={() => handleSelect(code)}
                >
                  <BookOpen className="h-5 w-5 shrink-0" />
                  <span className="font-medium text-sm">{code}</span>
                  {revealed && code === scenario.correctCode && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                  )}
                  {revealed && code === selected && code !== scenario.correctCode && (
                    <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation after answer */}
          {revealed && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <Badge className="text-xs">{scenario.correctCode}</Badge>
                <span className="text-sm font-semibold">{scenario.correctSection}</span>
              </div>
              <p className="text-sm text-muted-foreground">{scenario.explanation}</p>
              <Button className="w-full mt-2" onClick={handleNext}>
                {currentIndex < scenarios.length - 1 ? "Next Question" : "View Results"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
