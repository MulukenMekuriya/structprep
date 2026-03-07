import { createClient } from "@supabase/supabase-js";
import seedQuestions from "../content/seed-questions.json";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log(`Seeding ${seedQuestions.length} questions...`);

  const { data, error } = await supabase
    .from("sp_questions")
    .upsert(
      seedQuestions.map((q) => ({
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        question_text: q.question_text,
        options: q.options,
        correct_option_id: q.correct_option_id,
        solution_text: q.solution_text,
        code_references: q.code_references,
        hint: q.hint,
        source: q.source,
        generation_status: "approved",
        time_estimate_sec: q.time_estimate_sec,
      })),
      { onConflict: "id" }
    )
    .select("id, topic");

  if (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }

  console.log(`Seeded ${data.length} questions:`);
  data.forEach((q) => console.log(`  - ${q.id} (${q.topic})`));
}

seed();
