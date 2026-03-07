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

  // All attempts with question details
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select(
      "is_correct, time_spent_sec, created_at, sp_questions(topic, subtopic, difficulty)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!attempts || attempts.length === 0) {
    return NextResponse.json({
      totalAttempted: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      avgTimePerQuestion: 0,
      topicBreakdown: [],
      subtopicBreakdown: [],
      difficultyBreakdown: [],
      weeklyTrend: [],
      paceAnalysis: { avgTime: 0, fastestTopic: null, slowestTopic: null },
    });
  }

  let totalCorrect = 0;
  let totalTimeSec = 0;

  // Topic stats
  const topicData: Record<string, { correct: number; total: number; timeSec: number }> = {};
  for (const t of NCEES_TOPICS) {
    topicData[t] = { correct: 0, total: 0, timeSec: 0 };
  }

  // Subtopic stats
  const subtopicData: Record<string, { correct: number; total: number; topic: string }> = {};

  // Difficulty stats
  const diffData: Record<string, { correct: number; total: number }> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };

  // Weekly trend (group by ISO week)
  const weeklyMap: Record<string, { correct: number; total: number; date: string }> = {};

  for (const a of attempts) {
    const q = a as unknown as {
      sp_questions: { topic: string; subtopic: string; difficulty: string } | null;
    };
    const topic = q.sp_questions?.topic || "";
    const subtopic = q.sp_questions?.subtopic || "";
    const difficulty = q.sp_questions?.difficulty || "medium";

    if (a.is_correct) totalCorrect++;
    totalTimeSec += a.time_spent_sec || 0;

    // Topic
    if (topicData[topic]) {
      topicData[topic].total++;
      topicData[topic].timeSec += a.time_spent_sec || 0;
      if (a.is_correct) topicData[topic].correct++;
    }

    // Subtopic
    if (subtopic) {
      if (!subtopicData[subtopic]) {
        subtopicData[subtopic] = { correct: 0, total: 0, topic };
      }
      subtopicData[subtopic].total++;
      if (a.is_correct) subtopicData[subtopic].correct++;
    }

    // Difficulty
    if (diffData[difficulty]) {
      diffData[difficulty].total++;
      if (a.is_correct) diffData[difficulty].correct++;
    }

    // Weekly trend — group by week start (Monday)
    const date = new Date(a.created_at);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    const weekKey = monday.toISOString().split("T")[0];
    if (!weeklyMap[weekKey]) {
      weeklyMap[weekKey] = { correct: 0, total: 0, date: weekKey };
    }
    weeklyMap[weekKey].total++;
    if (a.is_correct) weeklyMap[weekKey].correct++;
  }

  // Format topic breakdown
  const topicBreakdown = NCEES_TOPICS.map((t) => ({
    topic: t,
    label: TOPIC_SHORT_LABELS[t],
    correct: topicData[t].correct,
    total: topicData[t].total,
    accuracy: topicData[t].total > 0
      ? Math.round((topicData[t].correct / topicData[t].total) * 100)
      : 0,
    avgTimeSec: topicData[t].total > 0
      ? Math.round(topicData[t].timeSec / topicData[t].total)
      : 0,
  }));

  // Format subtopic breakdown (only those with 2+ attempts)
  const subtopicBreakdown = Object.entries(subtopicData)
    .filter(([, s]) => s.total >= 2)
    .map(([name, s]) => ({
      name,
      topic: s.topic,
      topicLabel: TOPIC_SHORT_LABELS[s.topic as NCEESTopic] || s.topic,
      correct: s.correct,
      total: s.total,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Format difficulty breakdown
  const difficultyBreakdown = ["easy", "medium", "hard"].map((d) => ({
    difficulty: d,
    correct: diffData[d].correct,
    total: diffData[d].total,
    accuracy: diffData[d].total > 0
      ? Math.round((diffData[d].correct / diffData[d].total) * 100)
      : 0,
  }));

  // Weekly trend sorted
  const weeklyTrend = Object.values(weeklyMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Pace analysis
  const topicsByTime = topicBreakdown
    .filter((t) => t.total > 0)
    .sort((a, b) => a.avgTimeSec - b.avgTimeSec);

  return NextResponse.json({
    totalAttempted: attempts.length,
    totalCorrect,
    overallAccuracy: Math.round((totalCorrect / attempts.length) * 100),
    avgTimePerQuestion: Math.round(totalTimeSec / attempts.length),
    topicBreakdown,
    subtopicBreakdown,
    difficultyBreakdown,
    weeklyTrend,
    paceAnalysis: {
      avgTime: Math.round(totalTimeSec / attempts.length),
      fastestTopic: topicsByTime[0] || null,
      slowestTopic: topicsByTime[topicsByTime.length - 1] || null,
    },
  });
}
