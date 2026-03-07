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
  Search,
  CheckCircle2,
  Trophy,
  Timer,
  BookOpen,
  RotateCcw,
  Eye,
  Lightbulb,
} from "lucide-react";
import {
  CODE_NAV_CHALLENGES,
  type CodeNavChallenge,
} from "@/lib/data/code-nav-challenges";

interface NavResult {
  challenge: CodeNavChallenge;
  timeTaken: number;
  usedHint: boolean;
  skipped: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CODE_FILTER_OPTIONS = ["All", "ASCE 7-16", "ACI 318-14", "AISC 360-16", "NDS 2018", "IBC 2018", "TMS 402/602"] as const;

export default function CodeNavDrillPage() {
  const [mode, setMode] = useState<"intro" | "drill" | "results">("intro");
  const [challenges, setChallenges] = useState<CodeNavChallenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<NavResult[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [codeFilter, setCodeFilter] = useState<string>("All");
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Count-up timer
  useEffect(() => {
    if (mode !== "drill") return;

    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 200);

    return () => stopTimer();
  }, [mode, currentIndex, stopTimer]);

  function startDrill() {
    let filtered = CODE_NAV_CHALLENGES;
    if (codeFilter !== "All") {
      filtered = filtered.filter((c) => c.code === codeFilter);
    }
    const shuffled = shuffle(filtered).slice(0, 10);
    setChallenges(shuffled);
    setCurrentIndex(0);
    setResults([]);
    setElapsed(0);
    setShowHint(false);
    setUsedHint(false);
    startTimeRef.current = Date.now();
    setMode("drill");
  }

  function handleFound() {
    stopTimer();
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    setResults((r) => [
      ...r,
      { challenge: challenges[currentIndex], timeTaken, usedHint, skipped: false },
    ]);
    nextChallenge();
  }

  function handleSkip() {
    stopTimer();
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    setResults((r) => [
      ...r,
      { challenge: challenges[currentIndex], timeTaken, usedHint: true, skipped: true },
    ]);
    nextChallenge();
  }

  function nextChallenge() {
    if (currentIndex < challenges.length - 1) {
      setCurrentIndex((i) => i + 1);
      setShowHint(false);
      setUsedHint(false);
      setElapsed(0);
      startTimeRef.current = Date.now();
    } else {
      setMode("results");
    }
  }

  // ===== INTRO =====
  if (mode === "intro") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Search className="h-8 w-8 text-blue-500" />
            Code Navigation Trainer
          </h1>
          <p className="text-muted-foreground mt-1">
            Practice finding code sections in your physical books. Speed = exam points.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You'll see a <strong>code reference</strong> (e.g., "AISC 360-16 Table J3.2").</p>
            <p>Open your <strong>physical code book</strong> and find that section.</p>
            <p>Click <strong>"Found It!"</strong> when you've located it. A hint is available if you're stuck.</p>
            <p>Goal: find every section in under <strong>60 seconds</strong>.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter by Code Book</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {CODE_FILTER_OPTIONS.map((code) => (
                <Button
                  key={code}
                  variant={codeFilter === code ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCodeFilter(code)}
                >
                  {code}
                  {code !== "All" && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      {CODE_NAV_CHALLENGES.filter((c) => c.code === code).length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={startDrill}>
          <BookOpen className="h-5 w-5 mr-2" />
          Start Drill ({codeFilter === "All"
            ? Math.min(10, CODE_NAV_CHALLENGES.length)
            : Math.min(10, CODE_NAV_CHALLENGES.filter((c) => c.code === codeFilter).length)} lookups)
        </Button>
      </div>
    );
  }

  // ===== RESULTS =====
  if (mode === "results") {
    const completed = results.filter((r) => !r.skipped);
    const avgTime = completed.length > 0
      ? Math.round(completed.reduce((s, r) => s + r.timeTaken, 0) / completed.length)
      : 0;
    const underTarget = completed.filter((r) => r.timeTaken <= r.challenge.targetTimeSec).length;
    const skipped = results.filter((r) => r.skipped).length;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
            <CardTitle className="text-2xl">Navigation Drill Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border p-3">
                <div className="text-3xl font-bold">{avgTime}s</div>
                <p className="text-xs text-muted-foreground">Avg Lookup</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-3xl font-bold">{underTarget}/{completed.length}</div>
                <p className="text-xs text-muted-foreground">Under Target</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-3xl font-bold">{skipped}</div>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {results.map((r, i) => {
                const underTime = r.timeTaken <= r.challenge.targetTimeSec;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      r.skipped
                        ? "border-orange-200 dark:border-orange-900 opacity-60"
                        : underTime
                          ? "border-green-200 dark:border-green-900"
                          : "border-yellow-200 dark:border-yellow-900"
                    }`}
                  >
                    {r.skipped ? (
                      <Eye className="h-5 w-5 text-orange-500 shrink-0" />
                    ) : underTime ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <Timer className="h-5 w-5 text-yellow-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {r.challenge.code} {r.challenge.section}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {r.challenge.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-mono font-bold ${underTime ? "text-green-600" : "text-yellow-600"}`}>
                        {r.skipped ? "—" : `${r.timeTaken}s`}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        target: {r.challenge.targetTimeSec}s
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => setMode("intro")}>
                Back
              </Button>
              <Button onClick={startDrill}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Drill Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== DRILL MODE =====
  const challenge = challenges[currentIndex];
  if (!challenge) return null;

  const progressPct = (currentIndex / challenges.length) * 100;
  const overTarget = elapsed > challenge.targetTimeSec;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {challenges.length}
          </span>
          <Progress value={progressPct} className="w-32 h-2" />
        </div>
        <Badge variant="outline" className="text-xs">
          Target: {challenge.targetTimeSec}s
        </Badge>
      </div>

      {/* Main card */}
      <Card className="border-2">
        <CardHeader className="text-center space-y-4">
          <Badge className="mx-auto text-sm px-4 py-1">
            {challenge.code}
          </Badge>
          <CardTitle className="text-4xl font-mono tracking-tight">
            {challenge.section}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {challenge.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timer */}
          <div className="text-center">
            <div className={`text-6xl font-mono font-bold ${overTarget ? "text-red-500" : elapsed > challenge.targetTimeSec * 0.7 ? "text-yellow-500" : "text-foreground"}`}>
              {elapsed}s
            </div>
            {overTarget && (
              <p className="text-xs text-red-500 mt-1">Over target time!</p>
            )}
          </div>

          {/* Hint */}
          {showHint && (
            <div className="rounded-lg border bg-muted/50 p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span>{challenge.hint}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowHint(true);
                setUsedHint(true);
              }}
              disabled={showHint}
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showHint ? "Hint shown" : "Show Hint"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSkip}
            >
              Skip
            </Button>
          </div>

          <Button
            size="lg"
            className="w-full text-lg"
            onClick={handleFound}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Found It!
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
