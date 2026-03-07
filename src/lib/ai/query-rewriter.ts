import { getAnthropicClient } from "./client";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Rewrites a user query by incorporating conversation context so that
 * the RAG retriever can find relevant documents even when the user's
 * message relies on pronouns or references to earlier turns.
 *
 * Example:
 *   History: "Teach me about steel beam design" / "Here's how AISC..."
 *   User: "What about the phi factor for that?"
 *   Rewritten: "What is the phi factor (resistance factor) for steel beam design per AISC 360?"
 */
export async function rewriteQueryForRetrieval(
  currentMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  // If no history or the message is already self-contained (long enough
  // and doesn't have obvious anaphora), skip rewriting to save latency
  if (conversationHistory.length <= 1) return currentMessage;
  if (isLikelySelfContained(currentMessage)) return currentMessage;

  const anthropic = getAnthropicClient();

  // Use only the last 6 messages for context (3 turns) to keep it fast
  const recentHistory = conversationHistory.slice(-6);
  const historyBlock = recentHistory
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content.slice(0, 300)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: `You rewrite student queries to be self-contained for a document search system. The student is studying for the PE Civil: Structures exam.

Rules:
- Resolve pronouns ("it", "that", "this") using conversation context
- Expand abbreviated references ("the phi factor" → "the resistance factor φ for steel beam flexural design per AISC 360")
- Add the specific structural topic/code being discussed if not mentioned
- Keep the rewritten query concise — it's a search query, not an essay
- If the query is already self-contained, return it unchanged
- Return ONLY the rewritten query, nothing else`,
    messages: [
      {
        role: "user",
        content: `Conversation:\n${historyBlock}\n\nLatest query to rewrite: "${currentMessage}"`,
      },
    ],
  });

  const rewritten =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : currentMessage;

  // Sanity check: if rewriting produced something much longer or shorter, fall back
  if (rewritten.length > currentMessage.length * 5 || rewritten.length < 3) {
    return currentMessage;
  }

  return rewritten;
}

/**
 * Heuristic check: does the message look self-contained?
 * Returns true if the message is long, contains specific technical terms,
 * and doesn't have obvious anaphora.
 */
function isLikelySelfContained(message: string): boolean {
  const lower = message.toLowerCase();

  // Short messages with pronouns are almost certainly context-dependent
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

  // Messages with specific code references are likely self-contained
  const hasCodeRef = /\b(ACI|AISC|ASCE|NDS|IBC|AASHTO|TMS)\b/.test(message);
  const hasSection = /§\d|Section\s+\d/.test(message);
  if ((hasCodeRef || hasSection) && message.length > 30) return true;

  // Long messages with technical terms are likely self-contained
  if (message.length > 80) return true;

  return false;
}
