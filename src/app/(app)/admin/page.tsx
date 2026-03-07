"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Wand2, FileText, Loader2 } from "lucide-react";

export default function AdminPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/references/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setUploadStatus(
        `Uploaded successfully! Processing ${data.title}... (${data.id})`
      );
    } catch {
      setUploadStatus("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Reference Material
              </CardTitle>
              <CardDescription>
                Upload PDF files of structural codes (ACI 318, AISC 360, ASCE 7,
                etc.) to power the RAG pipeline and AI tutor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Document Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., ACI 318-19"
                    required
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
                <div className="space-y-2">
                  <Label htmlFor="file">PDF File</Label>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept=".pdf"
                    required
                  />
                </div>
                {uploadStatus && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    {uploadStatus}
                  </div>
                )}
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading & Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                AI Question Generation
              </CardTitle>
              <CardDescription>
                Generate PE-level practice questions from your reference
                materials using Claude AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-4">
                Upload reference materials first, then use AI to generate
                questions grounded in your actual codes.
              </p>
              <Button disabled>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Questions (Upload references first)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
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
              <div className="space-y-4">
                <Input type="file" accept=".json" />
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Import Questions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
