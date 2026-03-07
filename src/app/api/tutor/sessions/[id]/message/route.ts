import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIClient, AI_MODEL, AI_VISION_MODEL } from "@/lib/ai/client";
import { buildTutorSystemPrompt, type TutorContext } from "@/lib/ai/prompts";
import { retrieveContext, type RetrievalConfidence } from "@/lib/rag/retriever";
import { rewriteQueryForRetrieval } from "@/lib/ai/query-rewriter";
import { verifyTutorResponse, buildCorrectionPrompt } from "@/lib/ai/answer-verifier";
import { NCEES_TOPICS, TOPIC_SHORT_LABELS } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const userMessage: string = body.content || "";
  const studyMode = body.mode || "chat";
  const studyTopic = body.topic || undefined;
  const userImages: { base64: string; type: string }[] | undefined = body.images;
  const hasImages = userImages && userImages.length > 0;

  if (!userMessage && !hasImages) {
    return new Response("Message content or images required", { status: 400 });
  }

  // Save user message (text only — images are ephemeral)
  await supabase.from("sp_tutor_messages").insert({
    session_id: sessionId,
    role: "user",
    content: userMessage || (hasImages ? "[Uploaded image(s)]" : ""),
    tokens_used: 0,
  });

  // Get conversation history
  const { data: history } = await supabase
    .from("sp_tutor_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages = (history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // --- MULTI-TURN RAG: Run retrieval in parallel with query rewrite for speed ---
  // Start RAG with original query immediately; if rewrite finishes and differs, use that instead
  const [rewrittenQuery, studentContext, refsResult, originalRagResult] = await Promise.all([
    rewriteQueryForRetrieval(userMessage, messages.slice(0, -1)).catch(
      () => userMessage
    ),
    fetchStudentContext(supabase, user.id, studyMode, studyTopic),
    supabase
      .from("sp_reference_materials")
      .select("title")
      .eq("processing_status", "ready"),
    retrieveContext(userMessage, 5).catch(() => ({
      contexts: [] as Awaited<ReturnType<typeof retrieveContext>>["contexts"],
      confidence: "none" as RetrievalConfidence,
    })),
  ]);

  const refTitles = (refsResult.data || []).map(
    (r: { title: string }) => r.title
  );

  // If the rewritten query differs meaningfully, do a quick retrieval with it and merge
  let contexts = originalRagResult.contexts;
  let confidence = originalRagResult.confidence;
  if (rewrittenQuery !== userMessage && rewrittenQuery.length > 3) {
    try {
      const rewrittenRag = await retrieveContext(rewrittenQuery, 5);
      // Merge: deduplicate by chunk id, prefer higher scores
      const seen = new Set(contexts.map((c) => c.chunk.id));
      for (const ctx of rewrittenRag.contexts) {
        if (!seen.has(ctx.chunk.id)) {
          contexts.push(ctx);
          seen.add(ctx.chunk.id);
        }
      }
      // Keep top 5 by score
      contexts = contexts.sort((a, b) => b.score - a.score).slice(0, 5);
      if (rewrittenRag.confidence === "high" || (rewrittenRag.confidence === "medium" && confidence !== "high")) {
        confidence = rewrittenRag.confidence;
      }
    } catch {
      // Original results are fine
    }
  }

  // Build system prompt
  if (!process.env.QWEN_API_KEY) {
    return new Response("QWEN_API_KEY is not configured", { status: 500 });
  }
  const ai = getAIClient();
  const systemPrompt = buildTutorSystemPrompt(
    contexts,
    refTitles,
    studentContext,
    confidence
  );

  // --- Build messages array, with multimodal content for images ---
  type ChatMessage = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };
  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history (text-only from DB)
  for (const m of messages.slice(0, -1)) {
    chatMessages.push({ role: m.role, content: m.content });
  }

  // Build the current user message (potentially multimodal)
  if (hasImages) {
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

    // Add images first so the model sees them
    for (const img of userImages!) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${img.type};base64,${img.base64}` },
      });
    }

    // Add text instruction
    const textContent = userMessage
      || "Please look at this image carefully. If there are any circled, highlighted, or marked sections, focus on explaining those specific parts. Provide a detailed structural engineering explanation.";
    contentParts.push({ type: "text", text: textContent });

    chatMessages.push({ role: "user", content: contentParts });
  } else {
    chatMessages.push({ role: "user", content: userMessage });
  }

  // Use vision model when images are present
  const modelToUse = hasImages ? AI_VISION_MODEL : AI_MODEL;

  // --- STREAM response from Qwen ---
  let stream;
  try {
    stream = await ai.chat.completions.create({
      model: modelToUse,
      max_tokens: 16384,
      stream: true,
      messages: chatMessages as Parameters<typeof ai.chat.completions.create>[0]["messages"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI model error";
    console.error("Qwen API error:", msg);
    return new Response(`AI model error: ${msg}`, { status: 502 });
  }

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        // Append citations as a parseable block
        if (contexts.length > 0) {
          const citations = contexts.map((c) => ({
            source: c.source_title,
            section: c.chunk.section_ref || "General",
            page: c.chunk.page_number,
          }));
          controller.enqueue(
            encoder.encode(`\n<!--CITATIONS:${JSON.stringify(citations)}-->`)
          );
        }

        // Save assistant message (don't block stream close)
        Promise.resolve(
          supabase.from("sp_tutor_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: fullResponse,
            retrieved_chunks: contexts.map((c) => ({
              source: c.source_title,
              section: c.chunk.section_ref,
              page: c.chunk.page_number,
            })),
            tokens_used: fullResponse.length / 4,
          })
        ).then(() =>
          supabase.rpc("sp_increment_message_count", {
            session_id_param: sessionId,
          })
        ).catch(() => {});

        // Fire-and-forget: verify math in background (no longer blocks the stream)
        verifyTutorResponse(fullResponse).then(async (verification) => {
          if (!verification.verified && verification.errors.some((e) => e.severity === "critical")) {
            const correctionNote = buildCorrectionPrompt(verification.errors);
            // Save correction as a follow-up message (user sees it on next load)
            await supabase.from("sp_tutor_messages").insert({
              session_id: sessionId,
              role: "assistant",
              content: `**Correction:** ${correctionNote}`,
              tokens_used: correctionNote.length / 4,
            });
          }
        }).catch(() => {});

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

// --- Helper: Fetch student context for personalization ---
async function fetchStudentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studyMode: string,
  studyTopic: string | undefined
): Promise<TutorContext> {
  let tutorContext: TutorContext = {
    studyMode: studyMode as TutorContext["studyMode"],
    studyTopic,
  };

  try {
    const [{ data: profile }, { data: attempts }] = await Promise.all([
      supabase
        .from("sp_profiles")
        .select("full_name, exam_date")
        .eq("id", userId)
        .single(),
      supabase
        .from("sp_question_attempts")
        .select("is_correct, sp_questions(topic)")
        .eq("user_id", userId),
    ]);

    const topicStats: Record<string, { correct: number; total: number }> = {};
    for (const topic of NCEES_TOPICS) {
      topicStats[topic] = { correct: 0, total: 0 };
    }

    let totalAttempted = 0;
    let totalCorrect = 0;

    if (attempts) {
      for (const attempt of attempts) {
        totalAttempted++;
        if (attempt.is_correct) totalCorrect++;
        const topic = (
          attempt as unknown as { sp_questions: { topic: string } | null }
        ).sp_questions?.topic;
        if (topic && topicStats[topic]) {
          topicStats[topic].total++;
          if (attempt.is_correct) topicStats[topic].correct++;
        }
      }
    }

    const weakTopics = NCEES_TOPICS.filter(
      (t) =>
        topicStats[t].total >= 3 &&
        topicStats[t].correct / topicStats[t].total < 0.6
    ).map((t) => ({
      topic: t,
      label: TOPIC_SHORT_LABELS[t],
      accuracy:
        topicStats[t].total > 0
          ? Math.round((topicStats[t].correct / topicStats[t].total) * 100)
          : 0,
    }));

    const examDate = profile?.exam_date ? new Date(profile.exam_date) : null;
    const daysUntilExam = examDate
      ? Math.max(
          0,
          Math.ceil(
            (examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;

    tutorContext = {
      ...tutorContext,
      name: profile?.full_name,
      daysUntilExam,
      overallAccuracy:
        totalAttempted > 0
          ? Math.round((totalCorrect / totalAttempted) * 100)
          : 0,
      totalAttempted,
      weakTopics,
    };
  } catch {
    // Non-critical — proceed without personalization
  }

  return tutorContext;
}
