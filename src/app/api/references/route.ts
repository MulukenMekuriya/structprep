import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/references — list all uploaded reference materials */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sp_reference_materials")
    .select("id, title, category, total_chunks, processing_status, sections_toc, file_url, created_at")
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
