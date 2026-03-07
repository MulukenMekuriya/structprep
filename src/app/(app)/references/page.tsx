"use client";

import { useState } from "react";
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
import { Search, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function ReferencesPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reference Library</h1>
          <p className="text-muted-foreground">
            Search across your structural codes and materials using semantic +
            keyword search.
          </p>
        </div>
        <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
          <Upload className="h-4 w-4 mr-2" />
          Upload PDF
        </Link>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search codes, sections, concepts... (e.g., 'punching shear' or 'ACI 318 Table 22.2.2')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button>Search</Button>
      </div>

      {/* Uploaded Materials */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Uploaded Materials</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "ACI 318-19", category: "code", status: "Upload needed" },
            {
              title: "AISC 360-22",
              category: "code",
              status: "Upload needed",
            },
            {
              title: "ASCE 7-22",
              category: "code",
              status: "Upload needed",
            },
            {
              title: "NDS 2024",
              category: "code",
              status: "Upload needed",
            },
            {
              title: "TMS 402/602",
              category: "code",
              status: "Upload needed",
            },
            {
              title: "NCEES PE Reference Handbook",
              category: "handbook",
              status: "Upload needed",
            },
          ].map((material) => (
            <Card key={material.title} className="opacity-60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {material.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{material.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {material.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
