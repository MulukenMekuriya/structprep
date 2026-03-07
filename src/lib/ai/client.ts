import OpenAI from "openai";

let client: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.QWEN_API_KEY,
      baseURL: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
    });
  }
  return client;
}

/** @deprecated Use getAIClient() instead */
export const getAnthropicClient = getAIClient;

export const AI_MODEL = "qwen-plus";
export const AI_VISION_MODEL = "qwen3-vl-plus";

export const AI_RATE_LIMITS = {
  free: 50,
  pro: 200,
  enterprise: 1000,
} as const;
