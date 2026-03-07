import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get questions due for review (next_review_at <= now)
  const { data: queue } = await supabase
    .from("sp_spaced_repetition_queue")
    .select(
      "*, sp_questions(id, topic, subtopic, difficulty, question_text, options, correct_option_id, solution_text, code_references, hint, source, generation_status, time_estimate_sec, created_at)"
    )
    .eq("user_id", user.id)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(20);

  // Also get flagged questions from attempts
  const { data: flagged } = await supabase
    .from("sp_question_attempts")
    .select(
      "question_id, sp_questions(id, topic, subtopic, difficulty, question_text, options, correct_option_id, solution_text, code_references, hint, source, generation_status, time_estimate_sec, created_at)"
    )
    .eq("user_id", user.id)
    .eq("flagged", true)
    .order("created_at", { ascending: false })
    .limit(20);

  // Deduplicate flagged questions
  const seenIds = new Set(queue?.map((q) => q.question_id) || []);
  const uniqueFlagged =
    flagged?.filter((f) => !seenIds.has(f.question_id)) || [];

  return NextResponse.json({
    due: (queue || []).map((item) => ({
      ...item.sp_questions,
      sr_data: {
        ease_factor: item.ease_factor,
        interval_days: item.interval_days,
        repetitions: item.repetitions,
        next_review_at: item.next_review_at,
      },
    })),
    flagged: uniqueFlagged.map((item) => item.sp_questions),
    total_due: queue?.length || 0,
    total_flagged: uniqueFlagged.length,
  });
}
