import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { buildQuestionGenerationPrompt } from "@/lib/ai/prompts";
import { retrieveContext } from "@/lib/rag/retriever";
import type { NCEESTopic, Difficulty } from "@/types";
import { NCEES_TOPICS, TOPIC_SUBTOPICS } from "@/types";

export const maxDuration = 60;

interface GenerateRequest {
  topic: NCEESTopic;
  subtopic: string;
  difficulty: Difficulty;
  count: number; // how many questions to generate
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateRequest = await request.json();
  const { topic, subtopic, difficulty, count = 3 } = body;

  if (!topic || !subtopic || !difficulty) {
    return NextResponse.json(
      { error: "Missing required fields: topic, subtopic, difficulty" },
      { status: 400 }
    );
  }

  if (!NCEES_TOPICS.includes(topic)) {
    return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
  }

  const validSubtopics = TOPIC_SUBTOPICS[topic];
  if (!validSubtopics.includes(subtopic)) {
    return NextResponse.json({ error: "Invalid subtopic" }, { status: 400 });
  }

  const clampedCount = Math.min(Math.max(count, 1), 5);

  try {
    // Retrieve relevant context from uploaded references
    const searchQuery = `${subtopic} ${topic.replace(/_/g, " ")} structural engineering`;
    const { contexts, confidence } = await retrieveContext(searchQuery, 8);
    console.log(`RAG: ${contexts.length} contexts (${confidence}) for "${searchQuery}"`);

    if (contexts.length === 0) {
      return NextResponse.json(
        { error: "No reference materials found. Upload relevant PDFs first." },
        { status: 400 }
      );
    }

    const generated: unknown[] = [];

    for (let i = 0; i < clampedCount; i++) {
      const prompt = buildQuestionGenerationPrompt(
        topic.replace(/_/g, " "),
        subtopic,
        difficulty,
        contexts,
        confidence
      );

      const text = await generateText({
        maxTokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Failed to parse question JSON:", text);
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Invalid JSON from Claude:", jsonMatch[0]);
        continue;
      }

      // Validate required fields
      if (
        !parsed.question_text ||
        !parsed.options ||
        parsed.options.length !== 4 ||
        !parsed.correct_option_id ||
        !parsed.solution_text
      ) {
        console.error("Invalid question structure:", parsed);
        continue;
      }

      // Insert into database
      const { data: question, error: insertError } = await supabase
        .from("sp_questions")
        .insert({
          topic,
          subtopic,
          difficulty,
          question_text: parsed.question_text,
          options: parsed.options,
          correct_option_id: parsed.correct_option_id,
          solution_text: parsed.solution_text,
          code_references: parsed.code_references || [],
          hint: parsed.hint || null,
          source: "ai_generated",
          generation_status: "approved",
          time_estimate_sec: parsed.time_estimate_sec || 180,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Question insert error:", insertError);
        continue;
      }

      generated.push(question);
    }

    return NextResponse.json({
      generated: generated.length,
      requested: clampedCount,
      questions: generated,
    });
  } catch (error) {
    console.error("Question generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate questions",
      },
      { status: 500 }
    );
  }
}
