import type { ChunkType } from "@/types";

export interface RawChunk {
  text: string;
  type: ChunkType;
  sectionRef: string;
  chapter: string;
  pageNumber: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

const MAX_CHUNK_TOKENS = 1200;
const OVERLAP_TOKENS = 200;
const APPROX_CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

/**
 * Detect if a line is a section header (e.g., "22.2.2 — Nominal moment strength")
 * Common patterns in structural codes: numbered sections, chapter headers
 */
function isSectionHeader(line: string): boolean {
  const patterns = [
    /^\d+\.\d+(\.\d+)?\s+[—\-–]/,    // "22.2.2 — Title"
    /^Section\s+\d+/i,                 // "Section 22"
    /^Chapter\s+\d+/i,                 // "Chapter 22"
    /^Table\s+\d+/i,                   // "Table 22.2.2"
    /^Figure\s+\d+/i,                  // "Figure R22.2"
    /^SECTION\s+\d+/,                  // "SECTION 22"
    /^\d+\.\d+(\.\d+)?\s+[A-Z]/,      // "22.2.2 Nominal" (numbered + capitalized)
  ];
  return patterns.some((p) => p.test(line.trim()));
}

/**
 * Extract section reference from a header line
 */
function extractSectionRef(line: string): string {
  const match = line.match(
    /(?:Section\s+|Table\s+|Figure\s+)?(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)/i
  );
  return match ? match[1] : "";
}

/**
 * Detect if a chunk contains a table
 */
function isTableContent(text: string): boolean {
  const lines = text.split("\n");
  const tabbedLines = lines.filter(
    (l) => l.includes("\t") || /\s{3,}/.test(l)
  ).length;
  return tabbedLines > 3 && tabbedLines / lines.length > 0.5;
}

/**
 * Detect if a chunk contains equations (LaTeX or common math notation)
 */
function hasEquations(text: string): boolean {
  return /[=∑∫√φΦ]/.test(text) || /\\frac|\\sqrt|\\sum/.test(text);
}

/**
 * Section-aware chunking for structural engineering codes.
 * Priority 1: Split at section boundaries
 * Priority 2: Keep tables intact
 * Priority 3: Keep equations with surrounding context
 * Fallback: Token-based splitting with overlap
 */
export function chunkDocument(
  fullText: string,
  sourceTitle: string
): RawChunk[] {
  const lines = fullText.split("\n");
  const chunks: RawChunk[] = [];

  let currentChunk = "";
  let currentSection = "";
  let currentChapter = "";
  let currentPage = 1;

  // Detect page breaks (common in PDF extraction: form feed or "Page X" markers)
  function checkPageBreak(line: string): boolean {
    if (line.includes("\f")) {
      currentPage++;
      return true;
    }
    const pageMatch = line.match(/^[-—]\s*(\d+)\s*[-—]$/);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10);
      return true;
    }
    return false;
  }

  for (const line of lines) {
    // Track page numbers
    if (checkPageBreak(line)) continue;

    // Check for chapter headers
    const chapterMatch = line.match(/^Chapter\s+(\d+)\s*[—\-–:]\s*(.*)/i);
    if (chapterMatch) {
      currentChapter = `${chapterMatch[1]} - ${chapterMatch[2].trim()}`;
    }

    // If we hit a section header, flush the current chunk
    if (isSectionHeader(line) && currentChunk.trim()) {
      const tokens = estimateTokens(currentChunk);
      if (tokens > 20) {
        // Don't create tiny chunks
        const chunkType: ChunkType = isTableContent(currentChunk)
          ? "table"
          : hasEquations(currentChunk)
            ? "equation"
            : "section";

        chunks.push({
          text: currentChunk.trim(),
          type: chunkType,
          sectionRef: currentSection,
          chapter: currentChapter,
          pageNumber: currentPage,
          tokenCount: tokens,
          metadata: { source: sourceTitle },
        });
      }
      currentChunk = "";
      currentSection = extractSectionRef(line);
    }

    currentChunk += line + "\n";

    // If the chunk gets too large, split it
    if (estimateTokens(currentChunk) > MAX_CHUNK_TOKENS) {
      const chunkType: ChunkType = isTableContent(currentChunk)
        ? "table"
        : hasEquations(currentChunk)
          ? "equation"
          : "section";

      chunks.push({
        text: currentChunk.trim(),
        type: chunkType,
        sectionRef: currentSection,
        chapter: currentChapter,
        pageNumber: currentPage,
        tokenCount: estimateTokens(currentChunk),
        metadata: { source: sourceTitle },
      });

      // Keep overlap for context continuity
      const words = currentChunk.split(/\s+/);
      const overlapWords = Math.ceil(
        OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN
      );
      currentChunk =
        words.slice(Math.max(0, words.length - overlapWords)).join(" ") + "\n";
    }
  }

  // Flush remaining content
  if (currentChunk.trim() && estimateTokens(currentChunk) > 20) {
    chunks.push({
      text: currentChunk.trim(),
      type: isTableContent(currentChunk)
        ? "table"
        : hasEquations(currentChunk)
          ? "equation"
          : "section",
      sectionRef: currentSection,
      chapter: currentChapter,
      pageNumber: currentPage,
      tokenCount: estimateTokens(currentChunk),
      metadata: { source: sourceTitle },
    });
  }

  return chunks;
}
