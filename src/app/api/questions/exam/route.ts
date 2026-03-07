import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NCEES_TOPICS, TOPIC_WEIGHTS } from "@/types";

/**
 * GET /api/questions/exam
 * Returns 80 questions distributed by NCEES topic weights, shuffled randomly.
 * Falls back gracefully if not enough questions exist per topic.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const TOTAL = 80;
  const allQuestions: Record<string, unknown>[] = [];

  // Calculate target count per topic
  const targets = NCEES_TOPICS.map((topic) => ({
    topic,
    target: Math.round(TOPIC_WEIGHTS[topic] * TOTAL),
  }));

  // Adjust to ensure exactly 80 total
  const totalTarget = targets.reduce((sum, t) => sum + t.target, 0);
  if (totalTarget !== TOTAL) {
    // Add/subtract from the largest topic
    const largest = targets.reduce((a, b) => (a.target > b.target ? a : b));
    largest.target += TOTAL - totalTarget;
  }

  for (const { topic, target } of targets) {
    const { data } = await supabase
      .from("sp_questions")
      .select("*")
      .eq("topic", topic)
      .eq("generation_status", "approved")
      .limit(target);

    if (data) {
      allQuestions.push(...data);
    }
  }

  // If we have fewer than 80, fill from any topic
  if (allQuestions.length < TOTAL) {
    const existingIds = new Set(allQuestions.map((q) => (q as { id: string }).id));
    const { data: extras } = await supabase
      .from("sp_questions")
      .select("*")
      .eq("generation_status", "approved")
      .limit(TOTAL - allQuestions.length + 20); // fetch extra to filter

    if (extras) {
      for (const q of extras) {
        if (!existingIds.has(q.id) && allQuestions.length < TOTAL) {
          allQuestions.push(q);
          existingIds.add(q.id);
        }
      }
    }
  }

  // Shuffle (Fisher-Yates)
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  return NextResponse.json(allQuestions);
}
