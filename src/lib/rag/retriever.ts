import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./embeddings";
import type { DocumentChunk, RetrievedContext } from "@/types";

/**
 * Hybrid retriever: combines vector similarity search (pgvector) with
 * keyword search (tsvector), merged via Reciprocal Rank Fusion (RRF).
 */

const TOP_K_VECTOR = 10;
const TOP_K_KEYWORD = 10;
const TOP_K_FINAL = 5;
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
 * Reciprocal Rank Fusion (RRF) to merge vector and keyword results.
 * score(d) = sum( 1 / (k + rank_i(d)) ) for each ranker i
 */
function reciprocalRankFusion(
  vectorResults: { chunk: ChunkRow; rank: number }[],
  keywordResults: { chunk: ChunkRow; rank: number }[]
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

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

/**
 * Main retrieval function: hybrid search with RRF reranking.
 * Returns top-K chunks with source metadata.
 */
export async function retrieveContext(
  query: string,
  topK: number = TOP_K_FINAL
): Promise<RetrievedContext[]> {
  // Run vector and keyword searches in parallel
  const queryEmbedding = await generateEmbedding(query);
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(queryEmbedding),
    keywordSearch(query),
  ]);

  // Merge with RRF
  const fusedResults = reciprocalRankFusion(vectorResults, keywordResults);

  // Take top K and format
  return fusedResults.slice(0, topK).map(({ chunk, score }) => ({
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
}
