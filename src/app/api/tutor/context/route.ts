import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NCEES_TOPICS, TOPIC_SHORT_LABELS, type NCEESTopic } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Profile
  const { data: profile } = await supabase
    .from("sp_profiles")
    .select("full_name, exam_date, study_streak, total_study_minutes")
    .eq("id", user.id)
    .single();

  // All attempts with topic
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select("is_correct, time_spent_sec, sp_questions(topic, subtopic)")
    .eq("user_id", user.id);

  // Compute topic stats
  const topicStats: Record<string, { correct: number; total: number; accuracy: number }> = {};
  const subtopicStats: Record<string, { correct: number; total: number }> = {};

  for (const topic of NCEES_TOPICS) {
    topicStats[topic] = { correct: 0, total: 0, accuracy: 0 };
  }

  let totalAttempted = 0;
  let totalCorrect = 0;

  if (attempts) {
    for (const attempt of attempts) {
      totalAttempted++;
      if (attempt.is_correct) totalCorrect++;

      const q = attempt as unknown as { sp_questions: { topic: string; subtopic: string } | null };
      const topic = q.sp_questions?.topic;
      const subtopic = q.sp_questions?.subtopic;

      if (topic && topicStats[topic]) {
        topicStats[topic].total++;
        if (attempt.is_correct) topicStats[topic].correct++;
      }
      if (subtopic) {
        if (!subtopicStats[subtopic]) subtopicStats[subtopic] = { correct: 0, total: 0 };
        subtopicStats[subtopic].total++;
        if (attempt.is_correct) subtopicStats[subtopic].correct++;
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

  // Weak areas: topics < 60% with 3+ attempts
  const weakTopics = NCEES_TOPICS.filter(
    (t) => topicStats[t].total >= 3 && topicStats[t].accuracy < 60
  ).map((t) => ({
    topic: t,
    label: TOPIC_SHORT_LABELS[t],
    accuracy: topicStats[t].accuracy,
    total: topicStats[t].total,
  }));

  // Weak subtopics: < 50% with 2+ attempts
  const weakSubtopics = Object.entries(subtopicStats)
    .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.5)
    .map(([name, s]) => ({
      name,
      accuracy: Math.round((s.correct / s.total) * 100),
      total: s.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  // Recent mistakes (last 10 wrong answers)
  const { data: recentMistakes } = await supabase
    .from("sp_question_attempts")
    .select("question_id, sp_questions(question_text, topic, subtopic)")
    .eq("user_id", user.id)
    .eq("is_correct", false)
    .order("created_at", { ascending: false })
    .limit(10);

  // Exam countdown
  const examDate = profile?.exam_date ? new Date(profile.exam_date) : null;
  const daysUntilExam = examDate
    ? Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return NextResponse.json({
    name: profile?.full_name || null,
    daysUntilExam,
    studyStreak: profile?.study_streak ?? 0,
    totalMinutes: profile?.total_study_minutes ?? 0,
    totalAttempted,
    overallAccuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
    topicStats,
    weakTopics,
    weakSubtopics,
    recentMistakes: (recentMistakes || []).map((m) => {
      const q = m as unknown as { sp_questions: { question_text: string; topic: string; subtopic: string } | null };
      return {
        questionId: m.question_id,
        text: q.sp_questions?.question_text?.slice(0, 100) || "",
        topic: q.sp_questions?.topic || "",
        subtopic: q.sp_questions?.subtopic || "",
      };
    }),
  });
}
