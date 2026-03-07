import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NCEES_TOPICS } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questions } = await request.json();

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { error: "Request body must include a non-empty 'questions' array" },
      { status: 400 }
    );
  }

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // Validate required fields
    if (!q.topic || !q.question_text || !q.options || !q.correct_option_id) {
      errors.push(`Question ${i + 1}: missing required fields`);
      continue;
    }

    if (!NCEES_TOPICS.includes(q.topic)) {
      errors.push(`Question ${i + 1}: invalid topic "${q.topic}"`);
      continue;
    }

    const { error } = await supabase.from("sp_questions").insert({
      topic: q.topic,
      subtopic: q.subtopic || "",
      difficulty: q.difficulty || "medium",
      question_text: q.question_text,
      question_image_url: q.question_image_url || null,
      options: q.options,
      correct_option_id: q.correct_option_id,
      solution_text: q.solution_text || "",
      code_references: q.code_references || [],
      hint: q.hint || null,
      source: "import",
      generation_status: q.generation_status || "approved",
      time_estimate_sec: q.time_estimate_sec || 180,
    });

    if (error) {
      errors.push(`Question ${i + 1}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return NextResponse.json({
    imported,
    total: questions.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
