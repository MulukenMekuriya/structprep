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
import {
  Clock,
  Target,
  Flame,
  TrendingUp,
} from "lucide-react";
import { TOPIC_LABELS, type NCEESTopic } from "@/types";
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

  // Fetch recent session stats
  const { data: recentSessions } = await supabase
    .from("sp_study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(5);

  // Compute overall accuracy from recent sessions
  const totalCorrect =
    recentSessions?.reduce((sum, s) => sum + (s.correct_count || 0), 0) ?? 0;
  const totalQuestions =
    recentSessions?.reduce((sum, s) => sum + (s.total_questions || 0), 0) ?? 0;
  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}. Keep
          pushing.
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
            <p className="text-xs text-muted-foreground">Cumulative</p>
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
              {totalQuestions} questions attempted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Readiness Score
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Take a mock exam to calculate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <QuickActions />

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
