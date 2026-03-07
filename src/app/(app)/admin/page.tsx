"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Wand2, FileText, Loader2, CheckCircle2, AlertCircle, X, Database, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NCEES_TOPICS, TOPIC_LABELS, TOPIC_SUBTOPICS } from "@/types";
import type { NCEESTopic, Difficulty } from "@/types";

interface FileJob {
  id: string; // client-side id before we get a server id
  fileName: string;
  title: string;
  status: "pending" | "uploading" | "processing" | "ready" | "error";
  progress: number;
  message: string;
  materialId?: string;
  totalChunks?: number;
  processedChunks?: number;
}

export default function AdminPage() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const updateJob = useCallback((id: string, updates: Partial<FileJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  }, []);

  // Poll all processing jobs
  useEffect(() => {
    const processingJobs = jobs.filter((j) => j.status === "processing" && j.materialId);
    if (processingJobs.length === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      for (const job of processingJobs) {
        try {
          const res = await fetch(`/api/references/status?id=${job.materialId}`);
          if (!res.ok) continue;
          const data = await res.json();

          if (data.processing_status === "ready") {
            updateJob(job.id, {
              status: "ready",
              progress: 100,
              message: `Done! ${data.total_chunks} chunks.`,
              totalChunks: data.total_chunks,
              processedChunks: data.total_chunks,
            });
          } else if (data.processing_status === "error") {
            updateJob(job.id, {
              status: "error",
              message: "Processing failed. Check server logs.",
            });
          } else if (data.total_chunks > 0) {
            const pct = Math.round((data.processed_chunks / data.total_chunks) * 90) + 10;
            updateJob(job.id, {
              progress: pct,
              message: `Embedding: ${data.processed_chunks} / ${data.total_chunks} chunks`,
              totalChunks: data.total_chunks,
              processedChunks: data.processed_chunks,
            });
          }
        } catch {
          // Network error — keep polling
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs, updateJob]);

  // Check if any jobs are still active
  useEffect(() => {
    const active = jobs.some((j) => j.status === "uploading" || j.status === "processing");
    setIsRunning(active);
  }, [jobs]);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newJobs: FileJob[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      title: file.name.replace(/\.pdf$/i, ""),
      status: "pending" as const,
      progress: 0,
      message: "Waiting...",
    }));

    setJobs((prev) => [...prev, ...newJobs]);
  }

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  function updateTitle(id: string, title: string) {
    updateJob(id, { title });
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const files = fileInput?.files;
    const category = (form.querySelector<HTMLSelectElement>("#category"))?.value;

    if (!files || files.length === 0 || !category) return;

    const pendingJobs = jobs.filter((j) => j.status === "pending");
    if (pendingJobs.length === 0) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Process files sequentially (to avoid overwhelming storage/API)
    for (const job of pendingJobs) {
      // Find matching file
      const file = Array.from(files).find((f) => f.name === job.fileName);
      if (!file) {
        updateJob(job.id, { status: "error", message: "File not found." });
        continue;
      }

      try {
        // Upload to storage
        updateJob(job.id, { status: "uploading", progress: 5, message: "Uploading PDF..." });

        const storageName = `${crypto.randomUUID()}-${file.name}`;
        const { error: storageError } = await supabase.storage
          .from("references")
          .upload(storageName, file, { contentType: "application/pdf" });

        if (storageError) {
          updateJob(job.id, { status: "error", message: `Upload failed: ${storageError.message}` });
          continue;
        }

        updateJob(job.id, { progress: 10, message: "Uploaded. Starting processing..." });

        // Kick off background processing
        const res = await fetch("/api/references/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: job.title,
            category,
            storage_path: storageName,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          updateJob(job.id, { status: "error", message: err.error || "Processing failed" });
          continue;
        }

        const data = await res.json();
        updateJob(job.id, {
          status: "processing",
          materialId: data.id,
          message: "Processing text & embeddings...",
        });
      } catch (err) {
        updateJob(job.id, {
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
  }

  const pendingCount = jobs.filter((j) => j.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-muted-foreground">
          Manage reference materials, generate questions, and import content.
        </p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload References</TabsTrigger>
          <TabsTrigger value="generate">Generate Questions</TabsTrigger>
          <TabsTrigger value="import">Import Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <ReindexPagesCard />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Reference Materials
              </CardTitle>
              <CardDescription>
                Upload PDF files of structural codes (ACI 318, AISC 360, ASCE 7,
                etc.) to power the RAG pipeline and AI tutor. Select multiple files at once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form ref={formRef} onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">PDF Files</Label>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept=".pdf"
                    multiple
                    required
                    onChange={handleFilesChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="code">Structural Code</option>
                    <option value="handbook">Handbook</option>
                    <option value="formula">Formula Sheet</option>
                    <option value="study_guide">Study Guide</option>
                  </select>
                </div>

                {/* File queue */}
                {jobs.length > 0 && (
                  <div className="space-y-2">
                    <Label>Files</Label>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-md border bg-muted/50 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            {job.status === "ready" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : job.status === "error" ? (
                              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                            ) : job.status === "uploading" || job.status === "processing" ? (
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              {job.status === "pending" ? (
                                <Input
                                  value={job.title}
                                  onChange={(e) => updateTitle(job.id, e.target.value)}
                                  className="h-7 text-sm"
                                />
                              ) : (
                                <p className="text-sm font-medium truncate">{job.title}</p>
                              )}
                            </div>
                            {(job.status === "pending" || job.status === "ready" || job.status === "error") && (
                              <button
                                type="button"
                                onClick={() => removeJob(job.id)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {(job.status === "uploading" || job.status === "processing" || job.status === "ready") && (
                            <Progress value={job.progress} className="h-1.5" />
                          )}
                          <p className="text-xs text-muted-foreground">{job.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={isRunning || pendingCount === 0}>
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Process{pendingCount > 0 ? ` (${pendingCount} file${pendingCount > 1 ? "s" : ""})` : ""}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <BulkGenerateCard />
          <GenerateQuestionsCard />
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <SeedQuestionsCard />
          <ImportQuestionsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Bulk Generate Card =====

interface BulkPlan {
  current_total: number;
  target_total: number;
  total_needed: number;
  by_topic: Record<string, { existing: number; needed: number; target: number }>;
}

function BulkGenerateCard() {
  const [target, setTarget] = useState(400);
  const [plan, setPlan] = useState<BulkPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function loadPlan() {
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/generate-bulk?target=${target}`);
      const data = await res.json();
      setPlan(data);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/questions/generate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_total: target }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Generation failed");
      } else {
        setResult(data.message);
        loadPlan(); // refresh counts
      }
    } catch {
      setResult("Network error");
    } finally {
      setGenerating(false);
    }
  }

  const topicLabels: Record<string, string> = {
    loads_and_load_applications: "Loads",
    forces_and_load_effects: "Forces & Effects",
    temporary_structures_and_other: "Temp Structures",
    materials_and_properties: "Materials",
    component_design_and_detailing: "Component Design",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Bulk AI Generation
        </CardTitle>
        <CardDescription>
          Auto-generate questions to reach a target count, distributed by NCEES
          topic weights. Uses your uploaded reference PDFs for grounding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="bulk-target">Target Total Questions</Label>
            <Input
              id="bulk-target"
              type="number"
              min={100}
              max={1000}
              step={50}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value) || 400)}
              className="w-32"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadPlan} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview Plan"}
          </Button>
        </div>

        {plan && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-bold">{plan.current_total}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-bold text-primary">{plan.total_needed}</p>
                <p className="text-xs text-muted-foreground">To Generate</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-bold">{plan.target_total}</p>
                <p className="text-xs text-muted-foreground">Target</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {Object.entries(plan.by_topic).map(([topic, data]) => (
                <div key={topic} className="flex items-center gap-2 text-sm">
                  <span className="w-36 truncate text-muted-foreground">
                    {topicLabels[topic] || topic}
                  </span>
                  <Progress
                    value={(data.existing / Math.max(data.target, 1)) * 100}
                    className="flex-1 h-2"
                  />
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {data.existing}/{data.target} (+{data.needed})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md bg-muted p-3 text-sm">
            {result}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generating || !plan || plan.total_needed === 0}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating (this takes a while)...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate {plan?.total_needed || 0} Questions
            </>
          )}
        </Button>

        {generating && (
          <p className="text-xs text-muted-foreground">
            This runs sequentially to avoid rate limits. Each question takes ~5-10
            seconds. You can leave this page — generation continues server-side.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Generate Questions Card =====

function GenerateQuestionsCard() {
  const [topic, setTopic] = useState<NCEESTopic>(NCEES_TOPICS[0]);
  const [subtopic, setSubtopic] = useState(TOPIC_SUBTOPICS[NCEES_TOPICS[0]][0]);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ generated: number; questions: { id: string; question_text: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset subtopic when topic changes
  useEffect(() => {
    setSubtopic(TOPIC_SUBTOPICS[topic][0]);
  }, [topic]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, subtopic, difficulty, count }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          AI Question Generation
        </CardTitle>
        <CardDescription>
          Generate PE-level practice questions from your reference
          materials using Claude AI. Questions are saved as drafts for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gen-topic">Topic</Label>
              <select
                id="gen-topic"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={topic}
                onChange={(e) => setTopic(e.target.value as NCEESTopic)}
              >
                {NCEES_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gen-subtopic">Subtopic</Label>
              <select
                id="gen-subtopic"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
              >
                {TOPIC_SUBTOPICS[topic].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gen-difficulty">Difficulty</Label>
              <select
                id="gen-difficulty"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gen-count">Number of Questions (1-5)</Label>
              <Input
                id="gen-count"
                type="number"
                min={1}
                max={5}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-md bg-green-500/10 p-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Generated {result.generated} question{result.generated !== 1 ? "s" : ""} (saved as drafts)
              </div>
              {result.questions.map((q: { id: string; question_text: string }) => (
                <p key={q.id} className="text-xs text-muted-foreground ml-6 truncate">
                  {q.question_text.slice(0, 120)}...
                </p>
              ))}
            </div>
          )}

          <Button type="submit" disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate {count} Question{count > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ===== Seed Questions Card =====

function SeedQuestionsCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSeed() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/questions/seed", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setResult(data.error || "Seed failed");
      } else {
        let msg = `Imported ${data.imported} of ${data.total} seed questions.`;
        if (data.errors?.length) {
          msg += ` (${data.errors.length} errors)\n${data.errors.slice(0, 3).join("\n")}`;
        }
        setResult(msg);
      }
    } catch {
      setResult("Failed to load seed questions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Load Seed Questions
        </CardTitle>
        <CardDescription>
          Import 80 curated PE Civil: Structures practice questions covering all
          5 NCEES topics. These are hand-verified with correct calculations and
          code references.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {result && (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{result}</pre>
        )}
        <Button onClick={handleSeed} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Load 80 Seed Questions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== Reindex Pages Card =====

function ReindexPagesCard() {
  const [materials, setMaterials] = useState<{ id: string; title: string; total_chunks: number; processing_status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/references")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMaterials(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleReindex(id: string) {
    setReindexing(id);
    setResults((prev) => ({ ...prev, [id]: "Reindexing..." }));

    try {
      const res = await fetch(`/api/references/${id}/reindex-pages`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setResults((prev) => ({ ...prev, [id]: data.error || "Failed" }));
      } else {
        setResults((prev) => ({
          ...prev,
          [id]: `Updated ${data.updated}/${data.total_chunks} chunks (${data.total_pages} pages)`,
        }));
      }
    } catch {
      setResults((prev) => ({ ...prev, [id]: "Network error" }));
    } finally {
      setReindexing(null);
    }
  }

  async function handleReindexAll() {
    for (const mat of materials.filter((m) => m.processing_status === "ready")) {
      await handleReindex(mat.id);
    }
  }

  if (loading) return null;
  if (materials.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Reindex Page Numbers
        </CardTitle>
        <CardDescription>
          Fix page numbers for existing documents by re-reading the PDF. No
          embeddings are regenerated — this is fast and free.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReindexAll}
          disabled={reindexing !== null}
        >
          {reindexing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Reindex All Documents
        </Button>

        <div className="space-y-2">
          {materials.map((mat) => (
            <div
              key={mat.id}
              className="flex items-center gap-3 rounded-md border p-2 text-sm"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{mat.title}</span>
              <Badge variant="secondary" className="text-[10px]">
                {mat.total_chunks} chunks
              </Badge>
              {results[mat.id] && (
                <span className="text-xs text-muted-foreground max-w-48 truncate">
                  {results[mat.id]}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleReindex(mat.id)}
                disabled={reindexing !== null || mat.processing_status !== "ready"}
              >
                {reindexing === mat.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Reindex"
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Import Questions Card =====

function ImportQuestionsCard() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const questions = JSON.parse(text);

      if (!Array.isArray(questions)) {
        throw new Error("JSON must be an array of questions");
      }

      const res = await fetch("/api/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      const data = await res.json();
      setImportResult(`Imported ${data.imported} question${data.imported !== 1 ? "s" : ""}.`);
      form.reset();
    } catch (err) {
      setImportResult(
        err instanceof Error ? err.message : "Import failed"
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Bulk Import Questions
        </CardTitle>
        <CardDescription>
          Import questions from a JSON file matching the StructPrep
          question schema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleImport} className="space-y-4">
          <Input type="file" accept=".json" required />
          {importResult && (
            <p className="text-sm text-muted-foreground">{importResult}</p>
          )}
          <Button type="submit" variant="outline" disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Import Questions
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
