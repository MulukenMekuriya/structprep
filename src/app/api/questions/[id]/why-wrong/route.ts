import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, AI_MODEL } from "@/lib/ai/client";

const MISTAKE_CATEGORIES = [
  "wrong_code_section",
  "arithmetic_error",
  "forgot_factor",
  "wrong_load_combination",
  "unit_conversion_error",
  "conceptual_misunderstanding",
  "misread_question",
  "wrong_formula",
  "sign_error",
  "other",
] as const;

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
  const { selected_option_id } = body;

  // Fetch the question
  const { data: question } = await supabase
    .from("sp_questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const options = question.options as { id: string; text: string }[];
  const selectedOption = options.find((o) => o.id === selected_option_id);
  const correctOption = options.find((o) => o.id === question.correct_option_id);

  if (!selectedOption || !correctOption) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  const prompt = `You are analyzing why a PE Civil: Structures exam student got a question wrong. Classify the likely mistake.

Question: ${question.question_text}

Student chose: ${selectedOption.id}) ${selectedOption.text}
Correct answer: ${correctOption.id}) ${correctOption.text}

Solution: ${question.solution_text || "Not available"}
Code references: ${(question.code_references || []).join(", ")}

Classify the mistake into ONE of these categories:
- wrong_code_section: Used the wrong code section or standard
- arithmetic_error: Math mistake in calculations
- forgot_factor: Forgot a reduction factor (φ), safety factor, or adjustment
- wrong_load_combination: Used wrong load combination or load factors
- unit_conversion_error: Incorrect unit conversion
- conceptual_misunderstanding: Fundamental concept was wrong
- misread_question: Likely misread or misunderstood what was asked
- wrong_formula: Used the wrong formula entirely
- sign_error: Sign or direction error
- other: Doesn't fit above categories

Return ONLY valid JSON:
{
  "category": "one_of_the_categories_above",
  "label": "Short human-readable label (3-5 words)",
  "explanation": "1-2 sentence explanation of the likely mistake and how to avoid it next time",
  "tip": "One actionable exam tip to prevent this mistake"
}`;

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate category
    if (!MISTAKE_CATEGORIES.includes(parsed.category)) {
      parsed.category = "other";
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      category: "other",
      label: "Analysis unavailable",
      explanation: "Could not classify the mistake. Review the solution carefully.",
      tip: "Compare your approach step-by-step with the solution.",
    });
  }
}
