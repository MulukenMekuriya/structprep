import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const maxDuration = 300; // 5 min for large documents

/** POST /api/references/[id]/reindex-pages — re-parse PDF for page numbers, update chunks (no embeddings) */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the material with file_url
  const { data: material } = await supabase
    .from("sp_reference_materials")
    .select("id, title, file_url")
    .eq("id", id)
    .single();

  if (!material?.file_url) {
    return NextResponse.json({ error: "Material not found or no PDF" }, { status: 404 });
  }

  // Get ALL existing chunks (paginate past Supabase 1000-row default limit)
  let allChunks: { id: string; chunk_text: string; page_number: number }[] = [];
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from("sp_document_chunks")
      .select("id, chunk_text, page_number")
      .eq("document_id", id)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;
    allChunks = allChunks.concat(batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  const chunks = allChunks;

  if (chunks.length === 0) {
    return NextResponse.json({ error: "No chunks to update" }, { status: 404 });
  }

  // Extract storage path from file_url
  const urlObj = new URL(material.file_url);
  const storagePath = decodeURIComponent(
    urlObj.pathname.split("/object/public/references/")[1] || ""
  );

  if (!storagePath) {
    return NextResponse.json({ error: "Cannot determine storage path" }, { status: 400 });
  }

  // Use admin client for storage access
  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Download PDF
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from("references")
    .download(storagePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Failed to download PDF" }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());

  // Parse PDF per-page
  let pageTexts: string[];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    pageTexts = [];
    await pdfParse(buffer, {
      pagerender: async function (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) {
        const textContent = await pageData.getTextContent();
        const text = textContent.items.map((item: { str: string }) => item.str).join(" ");
        pageTexts.push(text);
        return text;
      },
    });
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }

  if (pageTexts.length === 0) {
    return NextResponse.json({ error: "No pages extracted" }, { status: 500 });
  }

  // Pre-lowercase all page texts for faster matching
  const pageLower = pageTexts.map((t) => t.toLowerCase());

  // For each chunk, find which page it best matches
  const updates: { id: string; page_number: number }[] = [];
  for (const chunk of chunks) {
    // Use more text for better matching (first 400 chars)
    const sample = chunk.chunk_text.slice(0, 400);
    // Extract significant words (5+ chars to avoid common short words)
    const words = sample
      .split(/\s+/)
      .map((w: string) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
      .filter((w: string) => w.length >= 5)
      .slice(0, 25);

    if (words.length < 3) continue;

    let bestPage = 0;
    let bestScore = 0;

    for (let pageIdx = 0; pageIdx < pageLower.length; pageIdx++) {
      const pageText = pageLower[pageIdx];
      let score = 0;
      for (const word of words) {
        if (pageText.includes(word)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestPage = pageIdx + 1; // 1-indexed
      }
    }

    // Update if we found a reasonable match (at least 20% of words)
    const threshold = Math.max(2, Math.floor(words.length * 0.2));
    if (bestPage > 0 && bestScore >= threshold) {
      updates.push({ id: chunk.id, page_number: bestPage });
    }
  }

  // Batch updates — group by page_number for fewer queries
  const byPage = new Map<number, string[]>();
  for (const u of updates) {
    const ids = byPage.get(u.page_number) || [];
    ids.push(u.id);
    byPage.set(u.page_number, ids);
  }

  let updated = 0;
  for (const [pageNum, ids] of byPage) {
    // Update in batches of 200 IDs per query
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      await adminClient
        .from("sp_document_chunks")
        .update({ page_number: pageNum })
        .in("id", batch);
      updated += batch.length;
    }
  }

  return NextResponse.json({
    message: `Reindexed page numbers for "${material.title}"`,
    total_chunks: chunks.length,
    updated,
    total_pages: pageTexts.length,
  });
}
