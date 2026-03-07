import { getAIClient, AI_MODEL } from "./client";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Rewrites a user query by incorporating conversation context so that
 * the RAG retriever can find relevant documents even when the user's
 * message relies on pronouns or references to earlier turns.
 */
export async function rewriteQueryForRetrieval(
  currentMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  if (conversationHistory.length <= 1) return currentMessage;
  if (isLikelySelfContained(currentMessage)) return currentMessage;

  const ai = getAIClient();

  const recentHistory = conversationHistory.slice(-6);
  const historyBlock = recentHistory
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content.slice(0, 300)}`)
    .join("\n");

  const response = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: `You rewrite student queries to be self-contained for a document search system. The student is studying for the PE Civil: Structures exam.

Rules:
- Resolve pronouns ("it", "that", "this") using conversation context
- Expand abbreviated references ("the phi factor" → "the resistance factor φ for steel beam flexural design per AISC 360")
- Add the specific structural topic/code being discussed if not mentioned
- Keep the rewritten query concise — it's a search query, not an essay
- If the query is already self-contained, return it unchanged
- Return ONLY the rewritten query, nothing else`,
      },
      {
        role: "user",
        content: `Conversation:\n${historyBlock}\n\nLatest query to rewrite: "${currentMessage}"`,
      },
    ],
  });

  const rewritten = response.choices[0]?.message?.content?.trim() ?? currentMessage;

  if (rewritten.length > currentMessage.length * 5 || rewritten.length < 3) {
    return currentMessage;
  }

  return rewritten;
}

function isLikelySelfContained(message: string): boolean {
  const lower = message.toLowerCase();

  const anaphoricPatterns = [
    /^what about /,
    /^how about /,
    /^and the /,
    /^what('s| is) (that|this|it|the) /,
    /^can you (also|explain) (that|this|it)/,
    /\b(that (one|formula|equation|section|value|factor|code))\b/,
    /^(yes|no|ok|sure|right),?\s/,
    /^why\??$/,
    /^how\??$/,
  ];

  if (anaphoricPatterns.some((p) => p.test(lower))) return false;

  const hasCodeRef = /\b(ACI|AISC|ASCE|NDS|IBC|AASHTO|TMS)\b/.test(message);
  const hasSection = /§\d|Section\s+\d/.test(message);
  if ((hasCodeRef || hasSection) && message.length > 30) return true;

  if (message.length > 80) return true;

  return false;
}
