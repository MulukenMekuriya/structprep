import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chunkDocument } from "@/lib/rag/chunker";
import { generateEmbeddingsBatch } from "@/lib/rag/embeddings";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, category, storage_path } = await request.json();

  if (!title || !category || !storage_path) {
    return NextResponse.json(
      { error: "Missing required fields: title, category, storage_path" },
      { status: 400 }
    );
  }

  try {
    const {
      data: { publicUrl },
    } = supabase.storage.from("references").getPublicUrl(storage_path);

    // Create reference material record
    const { data: material, error: insertError } = await supabase
      .from("sp_reference_materials")
      .insert({
        title,
        category,
        file_url: publicUrl,
        processing_status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      throw new Error(`DB insert failed: ${insertError.message}`);
    }

    // Return immediately — process in background
    const processingPromise = processDocument(supabase, material.id, storage_path, title);
    processingPromise.catch((err) => {
      console.error("Background processing error:", err);
    });

    return NextResponse.json({
      id: material.id,
      title,
      status: "processing",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processDocument(supabase: any, materialId: string, storagePath: string, title: string) {
  try {
    // 1. Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("references")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      await supabase
        .from("sp_reference_materials")
        .update({ processing_status: "error" })
        .eq("id", materialId);
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 2. Parse PDF with per-page text extraction
    let pdfText: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const pageTexts: string[] = [];
      const parsed = await pdfParse(buffer, {
        // Custom page renderer to capture per-page text
        pagerender: async function (pageData: { getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }> }) {
          const textContent = await pageData.getTextContent();
          const text = textContent.items.map((item: { str: string }) => item.str).join(" ");
          pageTexts.push(text);
          return text;
        },
      });
      // Join pages with form feed character so chunker can track page boundaries
      pdfText = pageTexts.length > 0 ? pageTexts.join("\n\f\n") : parsed.text;
    } catch (pdfErr) {
      console.error("PDF parse error:", pdfErr);
      await supabase
        .from("sp_reference_materials")
        .update({ processing_status: "error" })
        .eq("id", materialId);
      return;
    }

    // 3. Chunk the document
    const chunks = chunkDocument(pdfText, title);

    // Set total so the client can show progress
    await supabase
      .from("sp_reference_materials")
      .update({ total_chunks: chunks.length })
      .eq("id", materialId);

    console.log(`Processing ${chunks.length} chunks for "${title}"...`);

    // 4. Embed + insert in small batches with progress updates
    const BATCH_SIZE = 20;
    let processedCount = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batchChunks.map((c) => c.text);

      let embeddings: number[][];
      try {
        embeddings = await generateEmbeddingsBatch(batchTexts);
      } catch (embErr) {
        console.error(`Embeddings error at batch ${i}:`, embErr);
        await supabase
          .from("sp_reference_materials")
          .update({ processing_status: "error" })
          .eq("id", materialId);
        return;
      }

      const chunkInserts = batchChunks.map((chunk, j) => ({
        document_id: materialId,
        chunk_text: chunk.text,
        chunk_type: chunk.type,
        section_ref: chunk.sectionRef,
        chapter: chunk.chapter,
        page_number: chunk.pageNumber,
        token_count: chunk.tokenCount,
        embedding: JSON.stringify(embeddings[j]),
        metadata: chunk.metadata,
      }));

      const { error: chunkError } = await supabase
        .from("sp_document_chunks")
        .insert(chunkInserts);

      if (chunkError) {
        console.error("Chunk insert error:", chunkError);
      }

      processedCount += batchChunks.length;

      // Update progress in DB
      await supabase
        .from("sp_reference_materials")
        .update({ processed_chunks: processedCount })
        .eq("id", materialId);

      console.log(`Progress: ${processedCount}/${chunks.length} chunks`);
    }

    // 5. Done
    await supabase
      .from("sp_reference_materials")
      .update({
        processing_status: "ready",
        total_chunks: chunks.length,
        processed_chunks: chunks.length,
      })
      .eq("id", materialId);

    console.log(`Done processing "${title}" — ${chunks.length} chunks.`);
  } catch (error) {
    console.error("Processing failed:", error);
    await supabase
      .from("sp_reference_materials")
      .update({ processing_status: "error" })
      .eq("id", materialId);
  }
}
