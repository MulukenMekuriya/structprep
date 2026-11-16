import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { buildHintPrompt } from "@/lib/ai/prompts";
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

  const { level } = await request.json();

  if (![1, 2, 3].includes(level)) {
    return NextResponse.json({ error: "Invalid hint level (1-3)" }, { status: 400 });
  }

  const { data: question, error } = await supabase
    .from("sp_questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (error || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // For level 1, use the stored hint if available
  if (level === 1 && question.hint) {
    return NextResponse.json({ hint: question.hint });
  }

  // RAG retrieval
  const ragQuery = `${question.question_text} ${(question.code_references || []).join(" ")}`;
  let contexts: Awaited<ReturnType<typeof retrieveContext>>["contexts"] = [];
  let confidence: RetrievalConfidence = "none";
  try {
    const result = await retrieveContext(ragQuery, 5);
    contexts = result.contexts;
    confidence = result.confidence;
  } catch {
    contexts = [];
    confidence = "none";
  }

  const prompt = buildHintPrompt(question.question_text, level as 1 | 2 | 3, contexts, confidence);

  const hint = await generateText({
    maxTokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  return NextResponse.json({ hint, level });
}
