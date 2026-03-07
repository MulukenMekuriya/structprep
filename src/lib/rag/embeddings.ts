const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 20; // Smaller batches to stay under rate limits
// Hard limit: 8192 tokens for text-embedding-3-small
// Structural/engineering text tokenizes at ~2-3 chars/token
const MAX_INPUT_CHARS = 7000;
const MAX_RETRIES = 5;

export { EMBEDDING_DIMENSIONS };

/**
 * Generate embeddings using OpenAI's text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
  const response = await fetchWithRetry({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches with retry/backoff.
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts
      .slice(i, i + BATCH_SIZE)
      .map((t) => (t.length > MAX_INPUT_CHARS ? t.slice(0, MAX_INPUT_CHARS) : t));

    const data = await fetchWithRetry({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embeddings = data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((d: { embedding: number[] }) => d.embedding);

    allEmbeddings.push(...embeddings);

    // Delay between batches to respect TPM limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return allEmbeddings;
}

async function fetchWithRetry(
  body: Record<string, unknown>,
  attempt = 0
): Promise<{ data: { index: number; embedding: number[] }[] }> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    // Parse retry-after header, or use exponential backoff
    const retryAfter = response.headers.get("retry-after");
    const waitMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : Math.min(2000 * Math.pow(2, attempt), 60000);
    console.log(`Rate limited. Waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES}...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return fetchWithRetry(body, attempt + 1);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding batch API error: ${response.status} — ${error}`);
  }

  return response.json();
}
