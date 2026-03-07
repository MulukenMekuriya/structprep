import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import { buildQuestionGenerationPrompt } from "@/lib/ai/prompts";
import { retrieveContext } from "@/lib/rag/retriever";
import { NCEES_TOPICS, TOPIC_SUBTOPICS, TOPIC_WEIGHTS } from "@/types";
import type { NCEESTopic, Difficulty } from "@/types";

export const maxDuration = 300; // 5 min for bulk generation

interface BulkRequest {
  target_total: number; // total questions to aim for (e.g., 400)
  difficulties?: Difficulty[]; // defaults to ["easy","medium","hard"]
}

// NCEES-weighted distribution across topics
function computeDistribution(
  targetTotal: number,
  existingCounts: Record<string, number>
): { topic: NCEESTopic; subtopic: string; difficulty: Difficulty; needed: number }[] {
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];
  const diffWeights = { easy: 0.25, medium: 0.5, hard: 0.25 };
  const plan: { topic: NCEESTopic; subtopic: string; difficulty: Difficulty; needed: number }[] = [];

  for (const topic of NCEES_TOPICS) {
    const topicWeight = TOPIC_WEIGHTS[topic];
    const topicTarget = Math.round(targetTotal * topicWeight);
    const subtopics = TOPIC_SUBTOPICS[topic];
    const perSubtopic = Math.max(1, Math.round(topicTarget / subtopics.length));

    for (const subtopic of subtopics) {
      for (const diff of difficulties) {
        const key = `${topic}:${subtopic}:${diff}`;
        const existing = existingCounts[key] || 0;
        const target = Math.max(1, Math.round(perSubtopic * diffWeights[diff]));
        const needed = Math.max(0, target - existing);

        if (needed > 0) {
          plan.push({ topic, subtopic, difficulty: diff, needed });
        }
      }
    }
  }

  return plan;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: BulkRequest = await request.json();
  const targetTotal = Math.min(Math.max(body.target_total || 400, 100), 1000);

  // Get existing question counts by topic/subtopic/difficulty
  const { data: existing } = await supabase
    .from("sp_questions")
    .select("topic, subtopic, difficulty");

  const existingCounts: Record<string, number> = {};
  for (const q of existing || []) {
    const key = `${q.topic}:${q.subtopic}:${q.difficulty}`;
    existingCounts[key] = (existingCounts[key] || 0) + 1;
  }

  const currentTotal = existing?.length || 0;
  const plan = computeDistribution(targetTotal, existingCounts);
  const totalNeeded = plan.reduce((sum, p) => sum + p.needed, 0);

  if (totalNeeded === 0) {
    return NextResponse.json({
      message: `Already at ${currentTotal} questions (target: ${targetTotal}). No generation needed.`,
      current_total: currentTotal,
      generated: 0,
    });
  }

  // Generate questions — process sequentially to avoid rate limits
  // Batch: generate up to 3 questions per API call by combining subtopics
  const client = getAIClient();
  let generated = 0;
  let errors = 0;
  const maxToGenerate = Math.min(totalNeeded, targetTotal - currentTotal);

  // Shuffle plan for variety
  const shuffled = plan.sort(() => Math.random() - 0.5);

  for (const item of shuffled) {
    if (generated >= maxToGenerate) break;

    const batchSize = Math.min(item.needed, 3); // Max 3 per call

    for (let batch = 0; batch < item.needed; batch += batchSize) {
      if (generated >= maxToGenerate) break;
      const count = Math.min(batchSize, item.needed - batch, maxToGenerate - generated);

      try {
        // Retrieve context for this subtopic
        const searchQuery = `${item.subtopic} ${item.topic.replace(/_/g, " ")} structural engineering`;
        const { contexts, confidence } = await retrieveContext(searchQuery, 6);

        if (contexts.length === 0) {
          console.log(`Skipping ${item.subtopic} — no reference context`);
          break;
        }

        for (let i = 0; i < count; i++) {
          const prompt = buildQuestionGenerationPrompt(
            item.topic.replace(/_/g, " "),
            item.subtopic,
            item.difficulty,
            contexts,
            confidence
          );

          const response = await client.chat.completions.create({
            model: AI_MODEL,
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
          });

          const text = response.choices[0]?.message?.content ?? "";

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error("No JSON in response");
            errors++;
            continue;
          }

          let parsed;
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            console.error("Invalid JSON");
            errors++;
            continue;
          }

          if (
            !parsed.question_text ||
            !parsed.options ||
            parsed.options.length !== 4 ||
            !parsed.correct_option_id ||
            !parsed.solution_text
          ) {
            console.error("Invalid question structure");
            errors++;
            continue;
          }

          const { error: insertError } = await supabase
            .from("sp_questions")
            .insert({
              topic: item.topic,
              subtopic: item.subtopic,
              difficulty: item.difficulty,
              question_text: parsed.question_text,
              options: parsed.options,
              correct_option_id: parsed.correct_option_id,
              solution_text: parsed.solution_text,
              code_references: parsed.code_references || [],
              hint: parsed.hint || null,
              source: "ai_generated",
              generation_status: "approved",
              time_estimate_sec: parsed.time_estimate_sec || 180,
            });

          if (insertError) {
            console.error("Insert error:", insertError);
            errors++;
            continue;
          }

          generated++;
          console.log(`Generated ${generated}/${maxToGenerate}: ${item.topic} / ${item.subtopic} (${item.difficulty})`);
        }
      } catch (error) {
        console.error(`Error generating for ${item.subtopic}:`, error);
        errors++;
      }
    }
  }

  return NextResponse.json({
    message: `Generated ${generated} new questions (${errors} errors). Total: ${currentTotal + generated}`,
    generated,
    errors,
    previous_total: currentTotal,
    new_total: currentTotal + generated,
    target: targetTotal,
  });
}

/** GET — preview the generation plan without generating */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetTotal = parseInt(searchParams.get("target") || "400", 10);

  const { data: existing } = await supabase
    .from("sp_questions")
    .select("topic, subtopic, difficulty");

  const existingCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  for (const q of existing || []) {
    const key = `${q.topic}:${q.subtopic}:${q.difficulty}`;
    existingCounts[key] = (existingCounts[key] || 0) + 1;
    topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
  }

  const plan = computeDistribution(targetTotal, existingCounts);
  const totalNeeded = plan.reduce((sum, p) => sum + p.needed, 0);

  // Summarize by topic
  const summary: Record<string, { existing: number; needed: number; target: number }> = {};
  for (const topic of NCEES_TOPICS) {
    const topicTarget = Math.round(targetTotal * TOPIC_WEIGHTS[topic]);
    summary[topic] = {
      existing: topicCounts[topic] || 0,
      needed: plan.filter((p) => p.topic === topic).reduce((s, p) => s + p.needed, 0),
      target: topicTarget,
    };
  }

  return NextResponse.json({
    current_total: existing?.length || 0,
    target_total: targetTotal,
    total_needed: totalNeeded,
    by_topic: summary,
  });
}
