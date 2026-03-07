"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Upload,
  FileText,
  Loader2,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  Eye,
  X,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Markdown } from "@/components/ui/markdown";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";

interface ReferenceMaterial {
  id: string;
  title: string;
  category: string;
  total_chunks: number;
  processing_status: string;
  sections_toc: string[] | null;
  file_url?: string;
  created_at: string;
}

interface SearchResult {
  chunk_text: string;
  section_ref: string;
  chapter: string;
  page_number: number;
  document_title: string;
  document_id: string;
  similarity: number;
}

interface DocumentChunk {
  id: string;
  chunk_text: string;
  chunk_type: string;
  section_ref: string;
  chapter: string;
  page_number: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  code: "Structural Code",
  handbook: "Handbook",
  formula: "Formula Sheet",
  study_guide: "Study Guide",
};

export default function ReferencesPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ReferencesPage />
    </Suspense>
  );
}

function ReferencesPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<{
    material: ReferenceMaterial;
    chunks: DocumentChunk[];
  } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [pdfView, setPdfView] = useState<{ url: string; title: string; page?: number } | null>(null);

  useEffect(() => {
    fetch("/api/references")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMaterials(data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-search if opened with ?q= parameter
  useEffect(() => {
    if (initialQuery) {
      handleSearch();
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResults(null);
    setSelectedDoc(null);

    try {
      const res = await fetch(`/api/references/search?q=${encodeURIComponent(query)}&limit=10`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  async function openDocument(materialId: string) {
    setDocLoading(true);
    try {
      const res = await fetch(`/api/references/${materialId}/sections`);
      if (!res.ok) throw new Error("Failed to load document");
      const data = await res.json();
      const local = materials.find((m) => m.id === materialId);
      const mat = { ...data.material, ...local, file_url: data.material?.file_url || local?.file_url };
      setSelectedDoc({ material: mat, chunks: data.chunks });
      setSearchResults(null);
    } catch {
      // ignore
    } finally {
      setDocLoading(false);
    }
  }

  function openPdf(fileUrl: string, title: string, page?: number) {
    const pageParam = page && page > 0 ? `#page=${page}` : "";
    setPdfView({ url: `${fileUrl}${pageParam}`, title, page });
  }

  function highlightText(text: string, q: string): string {
    if (!q.trim()) return text;
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return text;
    const regex = new RegExp(
      `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "gi"
    );
    return text.replace(regex, "**$1**");
  }

  // PDF viewer overlay
  const pdfOverlay = pdfView && (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-sm">{pdfView.title}</h3>
            {pdfView.page && (
              <p className="text-xs text-muted-foreground">Page {pdfView.page}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setPdfView(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <iframe
        src={pdfView.url}
        className="flex-1 w-full"
        title={pdfView.title}
      />
    </div>
  );

  // Document viewer
  if (selectedDoc) {
    const { material, chunks } = selectedDoc;
    const chapters = [...new Set(chunks.map((c) => c.chapter).filter(Boolean))];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{material.title}</h1>
            <p className="text-sm text-muted-foreground">
              {material.total_chunks} sections &middot;{" "}
              {CATEGORY_LABELS[material.category] || material.category}
            </p>
          </div>
          {material.file_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openPdf(material.file_url!, material.title)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View PDF
            </Button>
          )}
        </div>

        {/* Chapter navigation */}
        {chapters.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {chapters.map((ch) => (
              <Button
                key={ch}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  document
                    .getElementById(`chapter-${ch}`)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {ch}
              </Button>
            ))}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-3">
          {chunks.map((chunk, i) => {
            const showChapterHeader =
              chunk.chapter &&
              (i === 0 || chunks[i - 1].chapter !== chunk.chapter);

            return (
              <div key={chunk.id}>
                {showChapterHeader && (
                  <h2
                    id={`chapter-${chunk.chapter}`}
                    className="text-lg font-bold mt-6 mb-2 scroll-mt-4"
                  >
                    {chunk.chapter}
                  </h2>
                )}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {chunk.section_ref && (
                        <Badge variant="outline" className="text-[10px]">
                          {chunk.section_ref}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {chunk.chunk_type}
                      </Badge>
                      {chunk.page_number > 0 && (
                        <span
                          className={material.file_url ? "cursor-pointer hover:text-primary transition-colors" : ""}
                          onClick={() => material.file_url && openPdf(material.file_url, material.title, chunk.page_number)}
                        >
                          p. {chunk.page_number} {material.file_url ? "↗" : ""}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="text-sm leading-relaxed">
                      <Markdown>{chunk.chunk_text}</Markdown>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {chunks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No sections found for this document.
            </p>
          )}
        </div>
        {pdfOverlay}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Library className="h-6 w-6" />}
        iconGradient="from-indigo-500/10 to-blue-500/10"
        iconAccent="text-indigo-600 dark:text-indigo-400"
        title="Reference Library"
        description="Upload and search your PE exam reference codes"
        action={
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload PDF
          </Link>
        }
      />

      {/* Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search codes, sections, concepts... (e.g., 'punching shear' or 'AISC flexural capacity')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {/* Search Results */}
      {searching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {searchResults !== null && !searching && (
        <div className="space-y-3">
          <SectionHeader
            title={`${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${query}"`}
          />

          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No results found. Try different keywords or upload reference
              materials first.
            </p>
          ) : (
            searchResults.map((result, i) => (
              <Card
                key={i}
                className="hover:border-indigo-500/30 hover:shadow-md transition-all duration-200"
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {result.document_title}
                      </span>
                      {result.section_ref && (
                        <Badge variant="outline" className="text-[10px]">
                          {result.section_ref}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {result.page_number > 0 && (
                        <span>p. {result.page_number}</span>
                      )}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          result.similarity > 0.8
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : result.similarity > 0.6
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                              : ""
                        )}
                      >
                        {Math.round(result.similarity * 100)}% match
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="text-sm leading-relaxed line-clamp-4">
                    <Markdown>
                      {highlightText(
                        (result.chunk_text || "").slice(0, 500) +
                          ((result.chunk_text || "").length > 500 ? "..." : ""),
                        query
                      )}
                    </Markdown>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => openDocument(result.document_id)}
                    >
                      View in document
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                    {(() => {
                      const mat = materials.find((m) => m.id === result.document_id);
                      return mat?.file_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => openPdf(mat.file_url!, result.document_title, result.page_number)}
                        >
                          View PDF p.{result.page_number}
                          <Eye className="h-3 w-3 ml-1" />
                        </Button>
                      ) : null;
                    })()}
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchResults(null);
              setQuery("");
            }}
          >
            Clear results
          </Button>
        </div>
      )}

      {/* Document Library */}
      {searchResults === null && !searching && (
        <div>
          <SectionHeader
            title={loading ? "Loading..." : `Your Documents (${materials.length})`}
          />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : materials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">
                  No references uploaded yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload structural codes (ACI 318, AISC 360, ASCE 7, NDS, TMS
                  402) to power the hybrid search and AI tutor.
                </p>
                <Link href="/admin" className={cn(buttonVariants())}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First PDF
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {materials.map((material) => (
                <Card
                  key={material.id}
                  className="cursor-pointer hover:border-indigo-500/30 hover:shadow-md transition-all duration-200"
                  onClick={() => openDocument(material.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      {material.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {CATEGORY_LABELS[material.category] || material.category}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            material.processing_status === "ready"
                              ? "default"
                              : material.processing_status === "error"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {material.processing_status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {material.total_chunks} sections
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {docLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {pdfOverlay}
    </div>
  );
}
