import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sm2 } from "@/lib/algorithms/spaced-repetition";

/**
 * POST /api/review/rate — Update SR queue with self-rated quality.
 * Called from the Review page when user rates: Again(1), Hard(3), Good(4), Easy(5)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question_id, quality } = await request.json();

  if (!question_id || quality === undefined || quality < 0 || quality > 5) {
    return NextResponse.json(
      { error: "Missing question_id or invalid quality (0-5)" },
      { status: 400 }
    );
  }

  // Get existing SR entry
  const { data: existing } = await supabase
    .from("sp_spaced_repetition_queue")
    .select("*")
    .eq("user_id", user.id)
    .eq("question_id", question_id)
    .single();

  if (existing) {
    // Update with new quality rating
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

    return NextResponse.json({
      updated: true,
      next_review_at: result.nextReviewAt.toISOString(),
      interval_days: result.intervalDays,
    });
  } else {
    // Create new SR entry with this rating
    const result = sm2({
      quality,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
    });

    await supabase.from("sp_spaced_repetition_queue").insert({
      user_id: user.id,
      question_id,
      ease_factor: result.easeFactor.toString(),
      interval_days: result.intervalDays,
      repetitions: result.repetitions,
      next_review_at: result.nextReviewAt.toISOString(),
    });

    return NextResponse.json({
      created: true,
      next_review_at: result.nextReviewAt.toISOString(),
      interval_days: result.intervalDays,
    });
  }
}
