import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, AI_MODEL } from "@/lib/ai/client";
import { buildExplanationPrompt } from "@/lib/ai/prompts";
import { retrieveContext, type RetrievalConfidence } from "@/lib/rag/retriever";

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

  // Check for cached explanation first
  const { data: cached } = await supabase
    .from("sp_question_explanations")
    .select("explanation_text")
    .eq("question_id", questionId)
    .single();

  if (cached) {
    return NextResponse.json({ explanation: cached.explanation_text });
  }

  // Fetch the question
  const { data: question, error } = await supabase
    .from("sp_questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (error || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const body = await request.json();
  const userAnswer = body.selected_option_id || "";

  // RAG retrieval using question text and code references as query
  const ragQuery = `${question.question_text} ${(question.code_references || []).join(" ")}`;
  let contexts: Awaited<ReturnType<typeof retrieveContext>>["contexts"] = [];
  let confidence: RetrievalConfidence = "none";
  try {
    const result = await retrieveContext(ragQuery, 8);
    contexts = result.contexts;
    confidence = result.confidence;
  } catch {
    contexts = [];
    confidence = "none";
  }

  // Generate explanation via Claude
  const anthropic = getAnthropicClient();

  const correctOption = (question.options as { id: string; text: string }[]).find(
    (o) => o.id === question.correct_option_id
  );

  const prompt = buildExplanationPrompt(
    question.question_text,
    userAnswer,
    correctOption?.text || question.correct_option_id,
    question.code_references || [],
    contexts,
    confidence
  );

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const explanation =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Cache the explanation
  await supabase.from("sp_question_explanations").insert({
    question_id: questionId,
    explanation_text: explanation,
    retrieved_chunks: contexts.map((c) => ({
      source: c.source_title,
      section: c.chunk.section_ref,
      page: c.chunk.page_number,
    })),
  });

  return NextResponse.json({ explanation });
}
