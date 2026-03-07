import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export const AI_MODEL = "claude-sonnet-4-20250514";

export const AI_RATE_LIMITS = {
  free: 50,
  pro: 200,
  enterprise: 1000,
} as const;
