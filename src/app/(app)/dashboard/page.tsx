import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, SectionHeader, StatCard } from "@/components/ui/page-header";
import {
  Clock,
  Target,
  Flame,
  TrendingUp,
  AlertTriangle,
  Zap,
  BookOpen,
  MessageSquare,
  RotateCcw,
  ChevronRight,
  ArrowRight,
  GraduationCap,
  LayoutDashboard,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { CircularGauge } from "@/components/ui/circular-gauge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  NCEES_TOPICS,
  TOPIC_SHORT_LABELS,
  TOPIC_LABELS,
  TOPIC_WEIGHTS,
  type NCEESTopic,
} from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile } = await supabase
    .from("sp_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const studyStreak = profile?.study_streak ?? 0;
  const totalMinutes = profile?.total_study_minutes ?? 0;

  // Fetch all attempts with question topic
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select("is_correct, time_spent_sec, created_at, question_id, sp_questions(topic)")
    .eq("user_id", user.id);

  // Compute topic accuracy
  const topicStats: Record<
    string,
    { correct: number; total: number; accuracy: number }
  > = {};
  for (const topic of NCEES_TOPICS) {
    topicStats[topic] = { correct: 0, total: 0, accuracy: 0 };
  }

  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalTimeSec = 0;

  if (attempts) {
    for (const attempt of attempts) {
      totalAttempted++;
      totalTimeSec += attempt.time_spent_sec || 0;
      if (attempt.is_correct) totalCorrect++;

      const topic = (
        attempt as unknown as { sp_questions: { topic: string } | null }
      ).sp_questions?.topic;
      if (topic && topicStats[topic]) {
        topicStats[topic].total++;
        if (attempt.is_correct) topicStats[topic].correct++;
      }
    }
    for (const topic of NCEES_TOPICS) {
      if (topicStats[topic].total > 0) {
        topicStats[topic].accuracy = Math.round(
          (topicStats[topic].correct / topicStats[topic].total) * 100
        );
      }
    }
  }

  const overallAccuracy =
    totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const avgTimeSec =
    totalAttempted > 0 ? Math.round(totalTimeSec / totalAttempted) : 0;

  // Find weak areas (topics with accuracy < 60% and at least 3 attempts)
  const weakAreas = NCEES_TOPICS.filter(
    (t) => topicStats[t].total >= 3 && topicStats[t].accuracy < 60
  );

  // === Exam Readiness Score ===
  let weightedAccuracy = 0;
  let weightsCovered = 0;
  for (const topic of NCEES_TOPICS) {
    if (topicStats[topic].total >= 3) {
      weightedAccuracy += (topicStats[topic].accuracy / 100) * TOPIC_WEIGHTS[topic];
      weightsCovered += TOPIC_WEIGHTS[topic];
    }
  }
  const weightedAccuracyScore = weightsCovered > 0
    ? Math.min(100, Math.round((weightedAccuracy / weightsCovered) * 100))
    : 0;
  const topicsCovered = NCEES_TOPICS.filter((t) => topicStats[t].total >= 5).length;
  const coverageScore = Math.round((topicsCovered / NCEES_TOPICS.length) * 100);
  const TARGET_QUESTIONS = 400;
  const volumeScore = Math.min(100, Math.round((totalAttempted / TARGET_QUESTIONS) * 100));
  const consistencyScore = Math.min(100, Math.round((studyStreak / 30) * 100));
  const readinessScore = Math.round(
    weightedAccuracyScore * 0.4 +
    coverageScore * 0.25 +
    volumeScore * 0.2 +
    consistencyScore * 0.15
  );
  const readinessColor = readinessScore >= 70
    ? "text-green-500"
    : readinessScore >= 50
      ? "text-yellow-500"
      : readinessScore >= 20
        ? "text-orange-500"
        : "text-muted-foreground";

  // Fetch recent sessions
  const { data: recentSessions } = await supabase
    .from("sp_study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(5);

  // SR queue count
  const { count: dueCount } = await supabase
    .from("sp_spaced_repetition_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .lte("next_review_at", new Date().toISOString());

  // Exam date countdown
  const examDate = profile?.exam_date
    ? new Date(profile.exam_date)
    : null;
  const daysUntilExam = examDate
    ? Math.max(
        0,
        Math.ceil(
          (examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const isNewUser = totalAttempted < 5;
  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<LayoutDashboard className="h-6 w-6" />}
        iconGradient="from-indigo-500 to-violet-600"
        title={
          isNewUser
            ? `Welcome${firstName ? `, ${firstName}` : ""}!`
            : firstName
              ? `Hey, ${firstName}`
              : "Dashboard"
        }
        description={
          daysUntilExam !== null
            ? `${daysUntilExam} days until your PE exam`
            : "Your PE Structures exam prep overview"
        }
        badge={
          studyStreak > 0 ? (
            <Badge variant="outline" className="mt-2 gap-1.5 border-orange-500/30 text-orange-500 bg-orange-500/5">
              <Flame className="h-3.5 w-3.5" />
              {studyStreak} day streak
            </Badge>
          ) : undefined
        }
      />

      {/* New User Onboarding */}
      {isNewUser && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-purple-500/10 p-6 md:p-8">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-violet-500/5 blur-2xl" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 space-y-1.5">
              <h2 className="text-lg font-bold tracking-tight">Get started with your first practice session</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Answer 10 questions to unlock your personalized dashboard with accuracy tracking,
                weak area detection, and an exam readiness score.
              </p>
            </div>
            <Link
              href="/practice"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm h-11 px-7 shrink-0 gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20 glow-primary"
            >
              Start Practicing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Grid — 2 columns on desktop */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column — Takes 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Target className="h-4 w-4" />}
              iconColor="text-emerald-500"
              label="Accuracy"
              gradient="from-emerald-500/5 to-transparent"
              value={
                <div>
                  <span className="tabular-nums">{overallAccuracy}%</span>
                  <p className="text-[11px] font-normal text-muted-foreground">{totalAttempted} questions</p>
                </div>
              }
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              iconColor="text-blue-500"
              label="Study Time"
              gradient="from-blue-500/5 to-transparent"
              value={
                <div>
                  <span className="tabular-nums">
                    {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h` : `${totalMinutes}m`}
                    {totalMinutes >= 60 && <span className="text-lg"> {totalMinutes % 60}m</span>}
                  </span>
                  <p className="text-[11px] font-normal text-muted-foreground">{avgTimeSec}s avg/question</p>
                </div>
              }
            />
            <StatCard
              icon={<RotateCcw className="h-4 w-4" />}
              iconColor="text-amber-500"
              label="Review Due"
              gradient="from-amber-500/5 to-transparent"
              value={
                <div>
                  <span className="tabular-nums">{dueCount ?? 0}</span>
                  <p className="text-[11px] font-normal text-muted-foreground">
                    {(dueCount ?? 0) > 0 ? (
                      <Link href="/review" className="text-primary hover:underline">Review now</Link>
                    ) : "All caught up"}
                  </p>
                </div>
              }
            />
            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              iconColor="text-violet-500"
              label="Volume"
              gradient="from-violet-500/5 to-transparent"
              value={
                <div>
                  <span className="tabular-nums">{totalAttempted}</span>
                  <p className="text-[11px] font-normal text-muted-foreground">of {TARGET_QUESTIONS} target</p>
                </div>
              }
            />
          </div>

          {/* Topic Mastery */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Topic Mastery</CardTitle>
                <Link href="/analytics" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  View analytics <ChevronRight className="inline h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {NCEES_TOPICS.map((topic) => {
                const stats = topicStats[topic];
                const isWeak = stats.total >= 3 && stats.accuracy < 60;
                const barColor = stats.total === 0
                  ? ""
                  : stats.accuracy >= 70
                    ? "[&>div]:bg-green-500"
                    : stats.accuracy >= 50
                      ? "[&>div]:bg-yellow-500"
                      : "[&>div]:bg-orange-500";
                return (
                  <div key={topic} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-1.5">
                        {isWeak && (
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                        )}
                        {TOPIC_SHORT_LABELS[topic]}
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {Math.round(TOPIC_WEIGHTS[topic] * 100)}%
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {stats.total > 0 ? (
                          <>{stats.accuracy}% <span className="text-[10px]">({stats.correct}/{stats.total})</span></>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </span>
                    </div>
                    <Progress
                      value={stats.total > 0 ? stats.accuracy : 0}
                      className={`h-1.5 ${barColor}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Weak Areas Alert */}
          {weakAreas.length > 0 && (
            <div className="relative overflow-hidden rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-5">
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/15">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Focus Areas</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {weakAreas.map((topic) => (
                      <Badge
                        key={topic}
                        variant="outline"
                        className="text-[11px] border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/5"
                      >
                        {TOPIC_SHORT_LABELS[topic]} {topicStats[topic].accuracy}%
                      </Badge>
                    ))}
                  </div>
                </div>
                <Link
                  href="/practice/session?mode=weak-areas&count=15"
                  className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-9 px-4 shrink-0 gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white transition-opacity shadow-md shadow-orange-500/15"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Fix Weaknesses
                </Link>
              </div>
            </div>
          )}

          {/* Recent Sessions */}
          {(recentSessions?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentSessions!.map((session) => {
                    const scorePct = session.score_pct ? Math.round(Number(session.score_pct)) : null;
                    return (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <Badge
                          variant={session.type === "mock_exam" ? "default" : "secondary"}
                          className="text-[10px] w-16 justify-center"
                        >
                          {session.type === "mock_exam"
                            ? "Exam"
                            : session.type === "review"
                              ? "Review"
                              : "Practice"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.topic_filter
                              ? TOPIC_LABELS[session.topic_filter as NCEESTopic] || session.topic_filter
                              : "All Topics"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {session.total_questions}q &middot; {Math.round((session.duration_sec || 0) / 60)}m
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-sm font-bold tabular-nums",
                            scorePct !== null && scorePct >= 70 ? "text-green-500" : scorePct !== null && scorePct < 50 ? "text-red-500" : ""
                          )}>
                            {scorePct !== null ? `${scorePct}%` : "..."}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {session.correct_count}/{session.total_questions}
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

        {/* Right Column — 1/3 */}
        <div className="space-y-4">
          {/* Exam Readiness */}
          {!isNewUser ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Exam Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center py-3">
                  <CircularGauge
                    value={readinessScore}
                    colorClass={readinessColor}
                    label={
                      readinessScore >= 80
                        ? "On track!"
                        : readinessScore >= 60
                          ? "Keep pushing"
                          : readinessScore >= 30
                            ? "Building up"
                            : "Keep going"
                    }
                  />
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "Accuracy", value: weightedAccuracyScore, detail: `${weightedAccuracyScore}%`, color: "[&>div]:bg-emerald-500" },
                    { label: "Coverage", value: coverageScore, detail: `${topicsCovered}/${NCEES_TOPICS.length}`, color: "[&>div]:bg-blue-500" },
                    { label: "Volume", value: volumeScore, detail: `${totalAttempted}/${TARGET_QUESTIONS}`, color: "[&>div]:bg-violet-500" },
                    { label: "Streak", value: consistencyScore, detail: `${studyStreak}d`, color: "[&>div]:bg-orange-500" },
                  ].map(({ label, value, detail, color }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="tabular-nums font-medium">{detail}</span>
                      </div>
                      <Progress value={value} className={`h-1.5 ${color}`} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10">
                  <Target className="h-7 w-7 text-primary/40" />
                </div>
                <p className="text-sm font-semibold">Exam Readiness</p>
                <p className="text-xs text-muted-foreground">
                  Complete 5+ questions to unlock your readiness score
                </p>
                <Progress value={Math.round((totalAttempted / 5) * 100)} className="h-1.5 [&>div]:bg-primary" />
                <p className="text-[10px] text-muted-foreground tabular-nums">{totalAttempted}/5 questions</p>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions — Vertical stack */}
          <div className="space-y-2">
            <SectionHeader title="Quick Actions" />
            {[
              { href: "/practice", icon: BookOpen, label: "Practice", sublabel: "Topic-based questions", gradient: "from-indigo-500 to-violet-600", shadow: "shadow-indigo-500/15" },
              { href: "/exam", icon: Clock, label: "Mock Exam", sublabel: "80 questions, 9 hours", gradient: "from-blue-500 to-cyan-500", shadow: "shadow-blue-500/15" },
              { href: "/tutor", icon: MessageSquare, label: "AI Tutor", sublabel: "Ask anything", gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/15" },
            ].map(({ href, icon: Icon, label, sublabel, gradient, shadow }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl border p-3 hover-lift group"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-md ${shadow}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{sublabel}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
            {(dueCount ?? 0) > 0 && (
              <Link
                href="/review"
                className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-3 hover-lift group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/15">
                  <RotateCcw className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Review Due</p>
                  <p className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">{dueCount} questions waiting</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}
          </div>

          {/* Drill Shortcuts */}
          <div className="space-y-2">
            <SectionHeader title="Speed Drills" />
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/drills/which-code"
                className="rounded-xl border p-3.5 text-center hover-lift group"
              >
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/15">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-semibold">Which Code?</p>
              </Link>
              <Link
                href="/drills/code-nav"
                className="rounded-xl border p-3.5 text-center hover-lift group"
              >
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-500/15">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-semibold">Code Nav</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
