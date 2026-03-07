import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, AI_MODEL } from "@/lib/ai/client";
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
  const userMessage = body.content;
  const studyMode = body.mode || "chat";
  const studyTopic = body.topic || undefined;

  if (!userMessage) {
    return new Response("Message content required", { status: 400 });
  }

  // Save user message
  await supabase.from("sp_tutor_messages").insert({
    session_id: sessionId,
    role: "user",
    content: userMessage,
    tokens_used: 0,
  });

  // Get conversation history (needed for query rewriting + Claude context)
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

  // --- MULTI-TURN RAG: Rewrite query + fetch context in parallel ---
  const [rewrittenQuery, studentContext, refsResult] = await Promise.all([
    rewriteQueryForRetrieval(userMessage, messages.slice(0, -1)).catch(
      () => userMessage
    ),
    fetchStudentContext(supabase, user.id, studyMode, studyTopic),
    supabase
      .from("sp_reference_materials")
      .select("title")
      .eq("processing_status", "ready"),
  ]);

  const refTitles = (refsResult.data || []).map(
    (r: { title: string }) => r.title
  );

  // Retrieve context using the rewritten (context-aware) query
  let contexts: Awaited<ReturnType<typeof retrieveContext>>["contexts"] = [];
  let confidence: RetrievalConfidence = "none";
  try {
    const result = await retrieveContext(rewrittenQuery, 10);
    contexts = result.contexts;
    confidence = result.confidence;
  } catch {
    contexts = [];
    confidence = "none";
  }

  // Build system prompt
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY is not configured", { status: 500 });
  }
  const anthropic = getAnthropicClient();
  const systemPrompt = buildTutorSystemPrompt(
    contexts,
    refTitles,
    studentContext,
    confidence
  );

  // --- STREAM response from Claude ---
  const stream = anthropic.messages.stream({
    model: AI_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
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

        // --- POST-STREAM VERIFICATION: Check math in background ---
        // Run verification and save concurrently
        const [verification] = await Promise.all([
          verifyTutorResponse(fullResponse).catch(() => ({
            verified: true,
            errors: [],
            checksPerformed: 0,
          })),
          // Save assistant message
          (async () => {
            await supabase.from("sp_tutor_messages").insert({
              session_id: sessionId,
              role: "assistant",
              content: fullResponse,
              retrieved_chunks: contexts.map((c) => ({
                source: c.source_title,
                section: c.chunk.section_ref,
                page: c.chunk.page_number,
              })),
              tokens_used: fullResponse.length / 4,
            });
            await supabase.rpc("sp_increment_message_count", {
              session_id_param: sessionId,
            });
          })(),
        ]);

        // If verification found critical errors, stream a correction inline
        if (!verification.verified && verification.errors.some((e) => e.severity === "critical")) {
          const correctionNote = buildCorrectionPrompt(verification.errors);

          const correctionStream = anthropic.messages.stream({
            model: AI_MODEL,
            max_tokens: 2048,
            system: systemPrompt,
            messages: [
              ...messages,
              { role: "assistant", content: fullResponse },
              { role: "user", content: correctionNote },
            ],
          });

          controller.enqueue(
            encoder.encode("\n\n---\n\n**Correction:** ")
          );

          let correctionText = "";
          for await (const event of correctionStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              correctionText += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // Save correction as a separate message
          if (correctionText) {
            await supabase.from("sp_tutor_messages").insert({
              session_id: sessionId,
              role: "assistant",
              content: `**Correction:** ${correctionText}`,
              tokens_used: correctionText.length / 4,
            });
          }
        }

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
