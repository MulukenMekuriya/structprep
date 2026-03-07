import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sm2,
  attemptToQuality,
} from "@/lib/algorithms/spaced-repetition";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: questionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { selected_option_id, time_spent_sec, flagged, hints_used, session_id } =
    body;

  // Get the question to check answer
  const { data: question } = await supabase
    .from("sp_questions")
    .select("correct_option_id")
    .eq("id", questionId)
    .single();

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const isCorrect = selected_option_id === question.correct_option_id;

  // Record the attempt
  const { data: attempt, error } = await supabase
    .from("sp_question_attempts")
    .insert({
      user_id: user.id,
      question_id: questionId,
      selected_option_id,
      is_correct: isCorrect,
      time_spent_sec: time_spent_sec || 0,
      flagged: flagged || false,
      hints_used: hints_used || 0,
      session_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update spaced repetition queue
  const quality = attemptToQuality(isCorrect, hints_used || 0, flagged || false);

  const { data: existing } = await supabase
    .from("sp_spaced_repetition_queue")
    .select("*")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .single();

  if (existing) {
    // Update existing SR entry
    const result = sm2({
      quality,
      repetitions: existing.repetitions,
      easeFactor: parseFloat(existing.ease_factor),
      intervalDays: existing.interval_days,
    });

    await supabase
      .from("sp_spaced_repetition_queue")
      .update({
        ease_factor: result.easeFactor.toString(),
        interval_days: result.intervalDays,
        repetitions: result.repetitions,
        next_review_at: result.nextReviewAt.toISOString(),
      })
      .eq("id", existing.id);
  } else if (!isCorrect || flagged) {
    // Add to SR queue if incorrect or flagged
    const result = sm2({
      quality,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
    });

    await supabase.from("sp_spaced_repetition_queue").insert({
      user_id: user.id,
      question_id: questionId,
      ease_factor: result.easeFactor.toString(),
      interval_days: result.intervalDays,
      repetitions: result.repetitions,
      next_review_at: result.nextReviewAt.toISOString(),
    });
  }

  return NextResponse.json({
    ...attempt,
    correct_option_id: question.correct_option_id,
    is_correct: isCorrect,
  });
}
