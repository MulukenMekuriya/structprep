import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Reads ANTHROPIC_API_KEY from the environment. */
export function getAIClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export const AI_MODEL = "claude-opus-5-5";
/** Claude handles images natively, so the vision model is the same model. */
export const AI_VISION_MODEL = AI_MODEL;

export const AI_RATE_LIMITS = {
  free: 50,
  pro: 200,
  enterprise: 1000,
} as const;

type Effort = "low" | "medium" | "high";

// Thinking is always on for Opus 5.5 and its tokens count against max_tokens,
// so reserve headroom on top of the visible-answer budget.
const THINKING_HEADROOM = 2048;

const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

export interface GenerateOptions {
  system?: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  /** Max tokens for the visible answer (thinking headroom is added automatically). */
  maxTokens: number;
  /** Thinking depth. Use "low" for extraction/classification, "medium" for tutoring. */
  effort?: Effort;
}

/** Single non-streaming completion; returns the concatenated text ("" if refused). */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const response = await getAIClient().beta.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens + THINKING_HEADROOM,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort ?? "low" },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
  });
  return response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
}

/** Streaming completion; yields text deltas. */
export async function* streamText(
  opts: GenerateOptions
): AsyncGenerator<string> {
  const stream = getAIClient().beta.messages.stream({
    model: AI_MODEL,
    max_tokens: opts.maxTokens + THINKING_HEADROOM,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort ?? "medium" },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
