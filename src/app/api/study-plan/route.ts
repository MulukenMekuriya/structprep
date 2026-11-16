import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/client";
import { NCEES_TOPICS, TOPIC_SHORT_LABELS, TOPIC_WEIGHTS, type NCEESTopic } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const hoursPerWeek = body.hoursPerWeek || 10;

  // Profile
  const { data: profile } = await supabase
    .from("sp_profiles")
    .select("full_name, exam_date")
    .eq("id", user.id)
    .single();

  const examDate = profile?.exam_date ? new Date(profile.exam_date) : null;
  const daysUntilExam = examDate
    ? Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const weeksLeft = daysUntilExam ? Math.ceil(daysUntilExam / 7) : null;

  // Attempts
  const { data: attempts } = await supabase
    .from("sp_question_attempts")
    .select("is_correct, sp_questions(topic, subtopic)")
    .eq("user_id", user.id);

  const topicStats: Record<string, { correct: number; total: number }> = {};
  for (const t of NCEES_TOPICS) {
    topicStats[t] = { correct: 0, total: 0 };
  }

  if (attempts) {
    for (const a of attempts) {
      const q = a as unknown as { sp_questions: { topic: string } | null };
      const topic = q.sp_questions?.topic;
      if (topic && topicStats[topic]) {
        topicStats[topic].total++;
        if (a.is_correct) topicStats[topic].correct++;
      }
    }
  }

  const topicSummary = NCEES_TOPICS.map((t) => ({
    topic: TOPIC_SHORT_LABELS[t],
    examWeight: Math.round(TOPIC_WEIGHTS[t] * 100),
    attempted: topicStats[t].total,
    accuracy: topicStats[t].total > 0
      ? Math.round((topicStats[t].correct / topicStats[t].total) * 100)
      : null,
  }));

  const totalAttempted = attempts?.length || 0;
  const totalCorrect = attempts?.filter((a) => a.is_correct).length || 0;

  const prompt = `You are a PE Civil: Structures exam study coach. Generate a personalized weekly study plan.

STUDENT DATA:
- Name: ${profile?.full_name || "Student"}
- Exam date: ${examDate ? examDate.toLocaleDateString() : "Not set"}
- Days until exam: ${daysUntilExam ?? "Unknown"}
- Weeks left: ${weeksLeft ?? "Unknown"}
- Available study hours per week: ${hoursPerWeek}
- Total questions practiced: ${totalAttempted}
- Overall accuracy: ${totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0}%

TOPIC PERFORMANCE:
${topicSummary.map((t) => `  ${t.topic} (${t.examWeight}% of exam): ${t.attempted} Qs attempted, ${t.accuracy !== null ? t.accuracy + "% accuracy" : "not started"}`).join("\n")}

Generate a JSON study plan with this exact structure:
{
  "summary": "Brief 2-3 sentence overall strategy recommendation",
  "weeklySchedule": [
    {
      "day": "Monday",
      "hours": 2,
      "activities": [
        { "activity": "description of study activity", "duration": "1 hr", "topic": "topic name", "type": "learn|practice|review|exam" }
      ]
    }
  ],
  "priorityTopics": [
    { "topic": "topic name", "reason": "why this needs attention", "targetAccuracy": 75 }
  ],
  "milestones": [
    { "week": 1, "goal": "what to achieve by end of week 1" },
    { "week": 4, "goal": "what to achieve by end of week 4" }
  ],
  "examReadiness": {
    "currentScore": number (estimated 0-100),
    "targetScore": 70,
    "onTrack": boolean,
    "recommendation": "brief recommendation"
  }
}

Rules:
- Distribute ${hoursPerWeek} hours across the week (not all on one day)
- Weight study time toward weak topics but don't neglect strong ones
- Include a mix of learning, practice problems, and review
- Include at least one mock exam session if there are enough weeks left
- Component Design (37% of exam) should get the most attention
- Be specific about activities (e.g., "Practice 10 steel beam design problems" not "Study steel")
- Return ONLY valid JSON, no markdown or explanation outside the JSON`;


  try {
    const text = await generateText({
      maxTokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract JSON from response (handle potential markdown wrapping)
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        json = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse study plan");
      }
    }

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate study plan" },
      { status: 500 }
    );
  }
}
