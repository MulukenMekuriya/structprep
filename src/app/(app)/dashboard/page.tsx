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
import {
  Clock,
  Target,
  Flame,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  NCEES_TOPICS,
  TOPIC_SHORT_LABELS,
  TOPIC_LABELS,
  TOPIC_WEIGHTS,
  type NCEESTopic,
} from "@/types";
import { QuickActions } from "./quick-actions";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.
          {daysUntilExam !== null && (
            <span className="font-medium text-foreground">
              {" "}
              {daysUntilExam} days until your PE exam.
            </span>
          )}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studyStreak} days</div>
            <p className="text-xs text-muted-foreground">Keep it going!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Study Time
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(totalMinutes / 60)}h {totalMinutes % 60}m
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {avgTimeSec}s per question
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Accuracy
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAccuracy}%</div>
            <p className="text-xs text-muted-foreground">
              {totalAttempted} questions attempted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Review Due</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dueCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Questions in SR queue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Topic Mastery */}
      <Card>
        <CardHeader>
          <CardTitle>Topic Mastery</CardTitle>
          <CardDescription>
            Accuracy by NCEES exam category — aim for 70%+ across all topics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NCEES_TOPICS.map((topic) => {
            const stats = topicStats[topic];
            const isWeak = stats.total >= 3 && stats.accuracy < 60;
            return (
              <div key={topic} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    {isWeak && (
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    )}
                    {TOPIC_SHORT_LABELS[topic]}
                  </span>
                  <span className="text-muted-foreground">
                    {stats.total > 0 ? (
                      <>
                        {stats.accuracy}% ({stats.correct}/{stats.total})
                      </>
                    ) : (
                      "No attempts"
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={stats.total > 0 ? stats.accuracy : 0}
                    className={`h-2 ${isWeak ? "[&>div]:bg-orange-500" : ""}`}
                  />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {Math.round(TOPIC_WEIGHTS[topic] * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Weak Areas Alert */}
      {weakAreas.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Focus Areas
            </CardTitle>
            <CardDescription>
              These topics need attention — accuracy below 60%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {weakAreas.map((topic) => (
                <Badge
                  key={topic}
                  variant="outline"
                  className="border-orange-500/50 text-orange-700 dark:text-orange-400"
                >
                  {TOPIC_LABELS[topic]} — {topicStats[topic].accuracy}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Your latest study sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSessions && recentSessions.length > 0 ? (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        session.type === "mock_exam" ? "default" : "secondary"
                      }
                    >
                      {session.type === "mock_exam"
                        ? "Exam"
                        : session.type === "review"
                          ? "Review"
                          : "Practice"}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {session.topic_filter
                          ? TOPIC_LABELS[
                              session.topic_filter as NCEESTopic
                            ] || session.topic_filter
                          : "All Topics"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.total_questions} questions &middot;{" "}
                        {Math.round((session.duration_sec || 0) / 60)} min
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {session.score_pct
                        ? `${Math.round(Number(session.score_pct))}%`
                        : "In progress"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.correct_count}/{session.total_questions} correct
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sessions yet. Start practicing to see your progress here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
