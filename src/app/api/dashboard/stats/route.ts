import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NCEES_TOPICS, type NCEESTopic } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from("sp_profiles")
    .select("study_streak, total_study_minutes")
    .eq("id", user.id)
    .single();

  // Get all attempts for topic accuracy
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select("is_correct, question_id, sp_questions(topic)")
    .eq("user_id", user.id);

  // Compute topic accuracy
  const topicAccuracy: Record<
    string,
    { correct: number; total: number; accuracy: number }
  > = {};

  for (const topic of NCEES_TOPICS) {
    topicAccuracy[topic] = { correct: 0, total: 0, accuracy: 0 };
  }

  if (attempts) {
    for (const attempt of attempts) {
      const topic = (attempt as unknown as { sp_questions: { topic: string } | null })
        .sp_questions?.topic;
      if (topic && topicAccuracy[topic]) {
        topicAccuracy[topic].total++;
        if (attempt.is_correct) topicAccuracy[topic].correct++;
      }
    }
    for (const topic of NCEES_TOPICS) {
      if (topicAccuracy[topic].total > 0) {
        topicAccuracy[topic].accuracy =
          topicAccuracy[topic].correct / topicAccuracy[topic].total;
      }
    }
  }

  // Get recent sessions
  const { data: recentSessions } = await supabase
    .from("sp_study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(10);

  const totalAttempted = attempts?.length || 0;
  const totalCorrect = attempts?.filter((a) => a.is_correct).length || 0;
  const overallAccuracy =
    totalAttempted > 0 ? totalCorrect / totalAttempted : 0;

  return NextResponse.json({
    study_streak: profile?.study_streak || 0,
    total_study_minutes: profile?.total_study_minutes || 0,
    total_questions_attempted: totalAttempted,
    overall_accuracy: overallAccuracy,
    topic_accuracy: topicAccuracy,
    recent_sessions: recentSessions || [],
    readiness_score: 0, // Computed after mock exams
  });
}
