import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Calculate session stats from attempts
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select("is_correct, time_spent_sec")
    .eq("session_id", sessionId);

  const totalQuestions = attempts?.length || 0;
  const correctCount = attempts?.filter((a) => a.is_correct).length || 0;
  const scorePct =
    totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const durationSec =
    attempts?.reduce((sum, a) => sum + (a.time_spent_sec || 0), 0) || 0;

  const { data, error } = await supabase
    .from("sp_study_sessions")
    .update({
      total_questions: totalQuestions,
      correct_count: correctCount,
      score_pct: scorePct.toFixed(2),
      completed_at: new Date().toISOString(),
      duration_sec: durationSec,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user profile study time
  await supabase.rpc("sp_update_study_time", {
    user_id_param: user.id,
    minutes_to_add: Math.round(durationSec / 60),
  });

  return NextResponse.json(data);
}
