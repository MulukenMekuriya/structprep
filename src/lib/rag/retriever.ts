import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./embeddings";
import type { DocumentChunk, RetrievedContext } from "@/types";

export type RetrievalConfidence = "high" | "medium" | "low" | "none";

export interface RetrievalResult {
  contexts: RetrievedContext[];
  confidence: RetrievalConfidence;
}

/**
 * Hybrid retriever: combines vector similarity search (pgvector) with
 * keyword search (tsvector), merged via Reciprocal Rank Fusion (RRF).
 */

const TOP_K_VECTOR = 15;
const TOP_K_KEYWORD = 15;
const TOP_K_FINAL = 8;
const RRF_K = 60;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_type: string;
  section_ref: string;
  chapter: string;
  page_number: number;
  token_count: number;
  metadata: Record<string, unknown>;
  similarity?: number;
  // joined from reference_materials
  doc_title?: string;
}

/**
 * Vector similarity search using pgvector cosine distance.
 */
async function vectorSearch(
  queryEmbedding: number[],
  limit: number = TOP_K_VECTOR
): Promise<{ chunk: ChunkRow; rank: number }[]> {
  const supabase = getSupabaseAdmin();

  // Use Supabase RPC for vector search (requires a SQL function — see migration)
  const { data, error } = await supabase.rpc("sp_match_document_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: limit,
  });

  if (error) {
    console.error("Vector search error:", error);
    return [];
  }

  return (data || []).map((row: ChunkRow, index: number) => ({
    chunk: row,
    rank: index + 1,
  }));
}

/**
 * Full-text keyword search using PostgreSQL tsvector.
 */
async function keywordSearch(
  query: string,
  limit: number = TOP_K_KEYWORD
): Promise<{ chunk: ChunkRow; rank: number }[]> {
  const supabase = getSupabaseAdmin();

  // Use Supabase RPC for keyword search (requires a SQL function)
  const { data, error } = await supabase.rpc("sp_keyword_search_chunks", {
    search_query: query,
    match_count: limit,
  });

  if (error) {
    console.error("Keyword search error:", error);
    return [];
  }

  return (data || []).map((row: ChunkRow, index: number) => ({
    chunk: row,
    rank: index + 1,
  }));
}

/**
 * Extract section reference numbers from a search query.
 * E.g. "ASCE 7-16 26.11" → ["26.11"], "ACI 318 §22.2.2" → ["22.2.2"]
 */
function extractSectionRefs(query: string): string[] {
  const refs: string[] = [];
  // Match §X.Y.Z or Section X.Y.Z patterns
  const sectionPattern = /(?:§|Section\s*|Sec\.?\s*)(\d+(?:\.\d+)+)/gi;
  let match;
  while ((match = sectionPattern.exec(query)) !== null) {
    refs.push(match[1]);
  }
  // Match standalone dotted numbers like "26.11" or "22.2.2" (not year-like 2016, 7-16)
  const dottedPattern = /\b(\d{1,3}\.\d+(?:\.\d+)*)\b/g;
  while ((match = dottedPattern.exec(query)) !== null) {
    const num = match[1];
    // Skip if already captured or looks like a year/version (e.g., "7.16" from "7-16")
    if (!refs.includes(num)) {
      refs.push(num);
    }
  }
  return refs;
}

/**
 * Reciprocal Rank Fusion (RRF) to merge vector and keyword results.
 * score(d) = sum( 1 / (k + rank_i(d)) ) for each ranker i
 * Plus a section_ref boost when the query contains explicit section numbers.
 */
function reciprocalRankFusion(
  vectorResults: { chunk: ChunkRow; rank: number }[],
  keywordResults: { chunk: ChunkRow; rank: number }[],
  sectionRefs: string[] = []
): { chunk: ChunkRow; score: number }[] {
  const scores = new Map<string, { chunk: ChunkRow; score: number }>();

  for (const { chunk, rank } of vectorResults) {
    const existing = scores.get(chunk.id) || { chunk, score: 0 };
    existing.score += 1 / (RRF_K + rank);
    scores.set(chunk.id, existing);
  }

  for (const { chunk, rank } of keywordResults) {
    const existing = scores.get(chunk.id) || { chunk, score: 0 };
    existing.score += 1 / (RRF_K + rank);
    scores.set(chunk.id, existing);
  }

  // Boost chunks whose section_ref matches the queried section numbers
  if (sectionRefs.length > 0) {
    for (const entry of scores.values()) {
      const ref = entry.chunk.section_ref || "";
      for (const queryRef of sectionRefs) {
        if (ref === queryRef || ref.startsWith(queryRef + ".")) {
          // Exact match: massive boost (equivalent to rank 1 in a third ranker)
          entry.score += 1 / (RRF_K + 1);
        } else if (queryRef.startsWith(ref + ".")) {
          // Parent section match: moderate boost
          entry.score += 1 / (RRF_K + 5);
        }
      }
    }
  }

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

/**
 * Compute retrieval confidence based on RRF scores.
 * - high: multiple strong matches (top score > 0.025 and 3+ results above 0.02)
 * - medium: some matches (top score > 0.02 or 2+ results above 0.015)
 * - low: weak matches (has results but scores are low)
 * - none: no results at all
 *
 * RRF score ranges: max possible ~0.033 (rank 1 in both), typical good match ~0.02-0.03
 */
function computeConfidence(
  results: { chunk: ChunkRow; score: number }[]
): RetrievalConfidence {
  if (results.length === 0) return "none";

  const topScore = results[0].score;
  const strongMatches = results.filter((r) => r.score > 0.02).length;
  const decentMatches = results.filter((r) => r.score > 0.015).length;

  if (topScore > 0.025 && strongMatches >= 3) return "high";
  if (topScore > 0.02 || decentMatches >= 2) return "medium";
  return "low";
}

/**
 * Main retrieval function: hybrid search with RRF reranking.
 * Returns top-K chunks with source metadata and a confidence level.
 */
export async function retrieveContext(
  query: string,
  topK: number = TOP_K_FINAL
): Promise<RetrievalResult> {
  // Extract section references from query for boosting
  const sectionRefs = extractSectionRefs(query);

  // Run vector and keyword searches in parallel
  const queryEmbedding = await generateEmbedding(query);
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(queryEmbedding),
    keywordSearch(query),
  ]);

  // Merge with RRF (with section_ref boost)
  const fusedResults = reciprocalRankFusion(vectorResults, keywordResults, sectionRefs);

  const confidence = computeConfidence(fusedResults);

  // Take top K and format
  const contexts = fusedResults.slice(0, topK).map(({ chunk, score }) => ({
    chunk: {
      id: chunk.id,
      document_id: chunk.document_id,
      chunk_text: chunk.chunk_text,
      chunk_type: chunk.chunk_type as DocumentChunk["chunk_type"],
      section_ref: chunk.section_ref,
      chapter: chunk.chapter,
      page_number: chunk.page_number,
      token_count: chunk.token_count,
      metadata: chunk.metadata || {},
    },
    score,
    source_title: chunk.doc_title || "Unknown",
  }));

  return { contexts, confidence };
}
