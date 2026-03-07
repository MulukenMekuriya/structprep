import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retrieveContext } from "@/lib/rag/retriever";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  try {
    const { contexts, confidence } = await retrieveContext(query, limit);

    // Flatten for the frontend SearchResult interface
    const results = contexts.map((ctx) => ({
      chunk_text: ctx.chunk.chunk_text,
      section_ref: ctx.chunk.section_ref,
      chapter: ctx.chunk.chapter,
      page_number: ctx.chunk.page_number,
      document_title: ctx.source_title,
      document_id: ctx.chunk.document_id,
      similarity: Math.min(ctx.score / 0.05, 1),  // normalize RRF score to 0-1 (max ~0.049 with section boost)
    }));

    return NextResponse.json({ results, confidence });
  } catch (error) {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
