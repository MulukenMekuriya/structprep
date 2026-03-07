import type { RetrievedContext } from "@/types";

function formatRetrievedContext(contexts: RetrievedContext[]): string {
  return contexts
    .map(
      (ctx, i) =>
        `[SOURCE ${i + 1}: ${ctx.source_title}, ${ctx.chunk.section_ref || "General"}, p.${ctx.chunk.page_number}]\n${ctx.chunk.chunk_text}`
    )
    .join("\n\n");
}

export function buildTutorSystemPrompt(contexts: RetrievedContext[]): string {
  const contextBlock = formatRetrievedContext(contexts);

  return `You are an expert PE Civil: Structures exam tutor. You help students prepare for the NCEES PE exam by providing clear, accurate explanations grounded in actual structural engineering codes and standards.

You have access to the following reference materials:

${contextBlock}

Rules:
- Always cite specific code sections (e.g., ACI 318-19 Section 22.2.2, AISC 360 Chapter E)
- Show all calculations step-by-step with proper units
- Use proper structural engineering notation and LaTeX for equations (wrap in $ for inline, $$ for display)
- If a student's approach is wrong, explain WHY it's wrong before showing the correct approach
- When multiple methods exist (e.g., ASD vs LRFD), note which method you're using
- Keep explanations at a PE exam level — practical and focused on passing the exam
- If the reference materials don't contain the answer, say so explicitly rather than guessing
- When showing formulas, always define all variables
- Include the relevant code reference at the end of key statements`;
}

export function buildExplanationPrompt(
  questionText: string,
  userAnswer: string,
  correctAnswer: string,
  codeRefs: string[],
  contexts: RetrievedContext[]
): string {
  const contextBlock = formatRetrievedContext(contexts);

  return `You are a PE Structures exam tutor providing a detailed explanation.

Reference materials:
${contextBlock}

Question: ${questionText}
Student's answer: ${userAnswer}
Correct answer: ${correctAnswer}
Relevant codes: ${codeRefs.join(", ")}

Provide a comprehensive explanation that includes:
1. The correct approach and which code section governs
2. Step-by-step calculation with all intermediate values shown
3. Why the correct answer is correct (with code citation)
4. Common mistakes that lead to wrong answers
5. A brief note on related concepts the student should review

Use LaTeX notation for all equations ($ for inline, $$ for display). Show all units.`;
}

export function buildHintPrompt(
  questionText: string,
  level: 1 | 2 | 3,
  contexts: RetrievedContext[]
): string {
  const contextBlock = formatRetrievedContext(contexts);

  const levelInstructions = {
    1: "Give a conceptual nudge — point toward the right approach and the general topic area. Do NOT reveal any specific formulas, numbers, or code sections. Keep it to 1-2 sentences.",
    2: "Give a specific hint — identify the relevant code section and the key formula needed. Show the formula but do NOT plug in any numbers. Keep it to 2-3 sentences.",
    3: "Give a near-complete walkthrough — show the first 80% of the solution with numbers plugged in, but leave the final calculation step for the student to complete. Ask them to compute the final answer.",
  };

  return `You are a PE Structures exam tutor providing a Level ${level} hint.

Reference materials:
${contextBlock}

Question: ${questionText}

Instructions: ${levelInstructions[level]}

Use LaTeX notation for equations. Be encouraging but don't give away the full answer.`;
}

export function buildQuestionGenerationPrompt(
  topic: string,
  subtopic: string,
  difficulty: string,
  contexts: RetrievedContext[]
): string {
  const contextBlock = formatRetrievedContext(contexts);

  return `You are creating a PE Civil: Structures exam question.

Topic: ${topic}
Subtopic: ${subtopic}
Difficulty: ${difficulty}
Reference material:
${contextBlock}

Generate a multiple-choice question that:
- Tests practical application, not rote memorization
- Requires 3-6 calculation steps to solve
- Has exactly 4 options (A, B, C, D)
- Distractors should reflect common mistakes (wrong load factor, forgot phi, unit error, arithmetic slip)
- Include a complete step-by-step solution with code citations
- Estimate the solve time in seconds

Return ONLY valid JSON matching this exact schema:
{
  "question_text": "string with LaTeX in $...$",
  "options": [
    {"id": "A", "text": "string"},
    {"id": "B", "text": "string"},
    {"id": "C", "text": "string"},
    {"id": "D", "text": "string"}
  ],
  "correct_option_id": "A|B|C|D",
  "solution_text": "step-by-step solution with LaTeX",
  "code_references": ["ACI 318-19, Section X.X", ...],
  "hint": "brief conceptual hint",
  "time_estimate_sec": number
}`;
}
