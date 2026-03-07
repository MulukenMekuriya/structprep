import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing 'id' parameter" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("sp_reference_materials")
    .select("id, title, processing_status, total_chunks, processed_chunks")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Material not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
