import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/questions/weak-areas — Fetch questions targeted at user's weakest subtopics.
 * Returns questions from subtopics where accuracy < 60%, weighted by how weak they are.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "15", 10);

  // Get all attempts with question details
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select("is_correct, question_id, sp_questions(topic, subtopic)")
    .eq("user_id", user.id);

  if (!attempts || attempts.length === 0) {
    return NextResponse.json({ questions: [], weak_areas: [], message: "No attempts yet — start practicing first!" });
  }

  // Calculate subtopic accuracy
  const subtopicStats: Record<string, { correct: number; total: number; topic: string; questionIds: Set<string> }> = {};

  for (const a of attempts) {
    const q = a as unknown as { sp_questions: { topic: string; subtopic: string } | null };
    const subtopic = q.sp_questions?.subtopic;
    const topic = q.sp_questions?.topic;
    if (!subtopic || !topic) continue;

    if (!subtopicStats[subtopic]) {
      subtopicStats[subtopic] = { correct: 0, total: 0, topic, questionIds: new Set() };
    }
    subtopicStats[subtopic].total++;
    if (a.is_correct) subtopicStats[subtopic].correct++;
    subtopicStats[subtopic].questionIds.add(a.question_id);
  }

  // Find weak subtopics: accuracy < 60% with at least 2 attempts
  const weakSubtopics = Object.entries(subtopicStats)
    .filter(([, s]) => s.total >= 2 && (s.correct / s.total) < 0.6)
    .map(([name, s]) => ({
      name,
      topic: s.topic,
      accuracy: Math.round((s.correct / s.total) * 100),
      total: s.total,
      attemptedQuestionIds: Array.from(s.questionIds),
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // Worst first

  if (weakSubtopics.length === 0) {
    // Also check topic-level weaknesses
    const topicStats: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      const q = a as unknown as { sp_questions: { topic: string } | null };
      const topic = q.sp_questions?.topic;
      if (!topic) continue;
      if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
      topicStats[topic].total++;
      if (a.is_correct) topicStats[topic].correct++;
    }

    const weakTopics = Object.entries(topicStats)
      .filter(([, s]) => s.total >= 3 && (s.correct / s.total) < 0.6)
      .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));

    if (weakTopics.length === 0) {
      return NextResponse.json({
        questions: [],
        weak_areas: [],
        message: "No weak areas detected — great job! Try harder difficulty questions.",
      });
    }

    // Fetch questions from weak topics
    const weakTopicNames = weakTopics.map(([t]) => t);
    const { data: questions } = await supabase
      .from("sp_questions")
      .select("*")
      .eq("generation_status", "approved")
      .in("topic", weakTopicNames)
      .order("created_at", { ascending: false })
      .limit(limit);

    return NextResponse.json({
      questions: questions || [],
      weak_areas: weakTopics.map(([t, s]) => ({
        name: t,
        type: "topic",
        accuracy: Math.round((s.correct / s.total) * 100),
      })),
    });
  }

  // Fetch questions from weak subtopics, prioritizing ones not yet attempted
  const weakSubtopicNames = weakSubtopics.map((s) => s.name);
  const allAttemptedIds = weakSubtopics.flatMap((s) => s.attemptedQuestionIds);

  // First: try to get unattempted questions from weak subtopics
  let { data: questions } = await supabase
    .from("sp_questions")
    .select("*")
    .eq("generation_status", "approved")
    .in("subtopic", weakSubtopicNames)
    .limit(limit);

  if (questions && questions.length > 0) {
    // Sort: unattempted first, then from weakest subtopics
    const subtopicOrder = new Map(weakSubtopicNames.map((s, i) => [s, i]));
    const attemptedSet = new Set(allAttemptedIds);

    questions.sort((a, b) => {
      const aAttempted = attemptedSet.has(a.id) ? 1 : 0;
      const bAttempted = attemptedSet.has(b.id) ? 1 : 0;
      if (aAttempted !== bAttempted) return aAttempted - bAttempted;
      return (subtopicOrder.get(a.subtopic) ?? 99) - (subtopicOrder.get(b.subtopic) ?? 99);
    });

    questions = questions.slice(0, limit);
  }

  return NextResponse.json({
    questions: questions || [],
    weak_areas: weakSubtopics.map((s) => ({
      name: s.name,
      type: "subtopic",
      topic: s.topic,
      accuracy: s.accuracy,
      total: s.total,
    })),
  });
}
