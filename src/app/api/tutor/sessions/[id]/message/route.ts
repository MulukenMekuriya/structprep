import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, AI_MODEL } from "@/lib/ai/client";
import { buildTutorSystemPrompt } from "@/lib/ai/prompts";
import { retrieveContext } from "@/lib/rag/retriever";

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

  // Retrieve relevant context via RAG
  let contexts: Awaited<ReturnType<typeof retrieveContext>> = [];
  try {
    contexts = await retrieveContext(userMessage, 5);
  } catch {
    contexts = [];
  }

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

  // Stream response from Claude
  const anthropic = getAnthropicClient();
  const systemPrompt = buildTutorSystemPrompt(contexts);

  const stream = anthropic.messages.stream({
    model: AI_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  // Create a readable stream to send to client
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

        // Save assistant message after streaming completes
        await supabase.from("sp_tutor_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: fullResponse,
          retrieved_chunks: contexts.map((c) => ({
            source: c.source_title,
            section: c.chunk.section_ref,
            page: c.chunk.page_number,
          })),
          tokens_used: fullResponse.length / 4, // rough estimate
        });

        // Update session message count and timestamp
        await supabase.rpc("sp_increment_message_count", {
          session_id_param: sessionId,
        });

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
