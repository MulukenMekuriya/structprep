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

/**
 * Fast mode (Opus 5.5): ~2.5x faster output at 2x price. It has its own rate
 * limit, so on a 429 we retry once at standard speed.
 */
function isRateLimit(err: unknown): boolean {
  return err instanceof Anthropic.RateLimitError;
}

function buildParams(opts: GenerateOptions, fast: boolean) {
  return {
    model: AI_MODEL,
    max_tokens: opts.maxTokens + THINKING_HEADROOM,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort ?? "low" },
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
    ...(fast ? { speed: "fast" as const } : {}),
  };
}

/** Single non-streaming completion; returns the concatenated text ("" if refused). */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const run = (fast: boolean) =>
    getAIClient().beta.messages.create(buildParams(opts, fast));
  let response;
  try {
    response = await run(true);
  } catch (err) {
    if (!isRateLimit(err)) throw err;
    response = await run(false);
  }
  return response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
}

/** Streaming completion; yields text deltas. */
export async function* streamText(
  opts: GenerateOptions
): AsyncGenerator<string> {
  for (const fast of [true, false]) {
    let yielded = false;
    try {
      const stream = getAIClient().beta.messages.stream(
        buildParams(opts, fast)
      );
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yielded = true;
          yield event.delta.text;
        }
      }
      return;
    } catch (err) {
      // Only fall back to standard speed if fast mode was rate limited
      // before any text reached the client.
      if (!(fast && !yielded && isRateLimit(err))) throw err;
    }
  }
}
