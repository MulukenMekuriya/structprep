import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NCEES_TOPICS } from "@/types";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check how many questions already exist
  const { count } = await supabase
    .from("sp_questions")
    .select("*", { count: "exact", head: true });

  if (count && count >= 80) {
    return NextResponse.json({
      error: `Database already has ${count} questions. Clear existing questions first or use the import endpoint.`,
    }, { status: 400 });
  }

  // Read seed file from project root
  const seedPath = join(process.cwd(), "content", "seed-questions.json");
  let questions: Record<string, unknown>[];

  try {
    const raw = await readFile(seedPath, "utf-8");
    questions = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Could not read seed-questions.json" },
      { status: 500 }
    );
  }

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (!(NCEES_TOPICS as readonly string[]).includes(q.topic as string)) {
      errors.push(`Q${i + 1}: invalid topic`);
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
      source: "manual",
      generation_status: "approved",
      time_estimate_sec: q.time_estimate_sec || 180,
    });

    if (error) {
      errors.push(`Q${i + 1}: ${error.message}`);
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
