import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/references/[id]/sections — list chunks for a reference document */
export async function GET(
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

  // Get the material info
  const { data: material } = await supabase
    .from("sp_reference_materials")
    .select("id, title, category, sections_toc, file_url")
    .eq("id", id)
    .single();

  if (!material) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get all chunks for this document, ordered by page
  const { data: chunks } = await supabase
    .from("sp_document_chunks")
    .select("id, chunk_text, chunk_type, section_ref, chapter, page_number")
    .eq("document_id", id)
    .order("page_number", { ascending: true })
    .order("created_at", { ascending: true });

  return NextResponse.json({
    material,
    chunks: chunks || [],
  });
}
