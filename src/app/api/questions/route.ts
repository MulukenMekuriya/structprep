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

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic");
  const difficulty = searchParams.get("difficulty");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  let query = supabase
    .from("sp_questions")
    .select("*")
    .eq("generation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (topic) query = query.eq("topic", topic);
  if (difficulty) query = query.eq("difficulty", difficulty);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
