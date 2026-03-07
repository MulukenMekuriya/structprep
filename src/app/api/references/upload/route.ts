import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { chunkDocument } from "@/lib/rag/chunker";
import { generateEmbeddingsBatch } from "@/lib/rag/embeddings";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;

  if (!file || !title || !category) {
    return NextResponse.json(
      { error: "Missing required fields: file, title, category" },
      { status: 400 }
    );
  }

  // Use admin client for storage and DB operations
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Upload PDF to Supabase Storage
    const fileName = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await admin.storage
      .from("references")
      .upload(fileName, file, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = admin.storage.from("references").getPublicUrl(fileName);

    // 2. Create reference material record
    const { data: material, error: insertError } = await admin
      .from("sp_reference_materials")
      .insert({
        title,
        category,
        file_url: publicUrl,
        processing_status: "processing",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 3. Extract text from PDF (using pdf-parse)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pdfText: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const parsed = await pdfParse(buffer);
      pdfText = parsed.text;
    } catch {
      // Update status to error
      await admin
        .from("sp_reference_materials")
        .update({ processing_status: "error" })
        .eq("id", material.id);
      throw new Error("Failed to parse PDF");
    }

    // 4. Chunk the document
    const chunks = chunkDocument(pdfText, title);

    // 5. Generate embeddings in batches
    const chunkTexts = chunks.map((c) => c.text);
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddingsBatch(chunkTexts);
    } catch {
      await admin
        .from("sp_reference_materials")
        .update({ processing_status: "error" })
        .eq("id", material.id);
      throw new Error("Failed to generate embeddings");
    }

    // 6. Insert chunks with embeddings
    const chunkInserts = chunks.map((chunk, i) => ({
      document_id: material.id,
      chunk_text: chunk.text,
      chunk_type: chunk.type,
      section_ref: chunk.sectionRef,
      chapter: chunk.chapter,
      page_number: chunk.pageNumber,
      token_count: chunk.tokenCount,
      embedding: JSON.stringify(embeddings[i]),
      metadata: chunk.metadata,
    }));

    // Insert in batches of 100
    for (let i = 0; i < chunkInserts.length; i += 100) {
      const batch = chunkInserts.slice(i, i + 100);
      const { error: chunkError } = await admin
        .from("sp_document_chunks")
        .insert(batch);
      if (chunkError) {
        console.error("Chunk insert error:", chunkError);
      }
    }

    // 7. Update material status
    await admin
      .from("sp_reference_materials")
      .update({
        processing_status: "ready",
        total_chunks: chunks.length,
      })
      .eq("id", material.id);

    return NextResponse.json({
      id: material.id,
      title,
      total_chunks: chunks.length,
      status: "ready",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process upload",
      },
      { status: 500 }
    );
  }
}
