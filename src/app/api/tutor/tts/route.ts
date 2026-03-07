import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return new Response("Text is required", { status: 400 });
  }

  // Strip markdown/LaTeX for cleaner speech
  const cleanText = text
    .replace(/\$\$[\s\S]*?\$\$/g, " (formula) ") // block LaTeX
    .replace(/\$[^$]+\$/g, " (formula) ") // inline LaTeX
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, "") // LaTeX commands
    .replace(/```[\s\S]*?```/g, " (code block) ") // code blocks
    .replace(/`[^`]+`/g, (match) => match.slice(1, -1)) // inline code
    .replace(/#{1,6}\s/g, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/<!--[\s\S]*?-->/g, "") // HTML comments (citations)
    .replace(/\n{3,}/g, "\n\n") // excessive newlines
    .trim();

  if (!cleanText) {
    return new Response("No speakable content", { status: 400 });
  }

  // Truncate to ~4000 chars (TTS limit is ~4096 chars)
  const truncated = cleanText.slice(0, 4000);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("TTS not configured", { status: 500 });
  }

  const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: truncated,
      voice: "nova",
      response_format: "mp3",
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text();
    console.error("OpenAI TTS error:", err);
    return new Response("TTS generation failed", { status: 502 });
  }

  // Buffer the full response to avoid streaming issues with Audio element
  const audioBuffer = await ttsRes.arrayBuffer();

  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
