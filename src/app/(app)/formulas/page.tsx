"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Search } from "lucide-react";
import { NCEES_TOPICS, TOPIC_SHORT_LABELS } from "@/types";
import { FORMULA_SHEETS } from "@/lib/formulas";
import { Markdown } from "@/components/ui/markdown";

export default function FormulasPage() {
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase();

  function filterFormulas(topic: string) {
    const categories = FORMULA_SHEETS[topic] || [];
    if (!search) return categories;

    return categories
      .map((cat) => ({
        ...cat,
        formulas: cat.formulas.filter(
          (f) =>
            f.name.toLowerCase().includes(searchLower) ||
            f.description.toLowerCase().includes(searchLower) ||
            f.reference.toLowerCase().includes(searchLower) ||
            f.latex.toLowerCase().includes(searchLower)
        ),
      }))
      .filter((cat) => cat.formulas.length > 0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Formula Sheets</h1>
        <p className="text-muted-foreground">
          Key formulas organized by NCEES exam topic — rendered with LaTeX.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search formulas (e.g., moment, shear, wind, buckling...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue={NCEES_TOPICS[0]}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          {NCEES_TOPICS.map((topic) => (
            <TabsTrigger key={topic} value={topic} className="text-xs">
              {TOPIC_SHORT_LABELS[topic]}
            </TabsTrigger>
          ))}
        </TabsList>

        {NCEES_TOPICS.map((topic) => {
          const categories = filterFormulas(topic);

          return (
            <TabsContent key={topic} value={topic} className="space-y-6 mt-4">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {search
                    ? "No formulas match your search in this topic."
                    : "No formulas added for this topic yet."}
                </p>
              ) : (
                categories.map((category) => (
                  <Card key={category.title}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        {category.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {category.formulas.map((formula) => (
                          <div
                            key={formula.name}
                            className="rounded-lg border p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-sm">
                                {formula.name}
                              </h4>
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                {formula.reference}
                              </Badge>
                            </div>
                            <div className="text-center py-2">
                              <Markdown>{`$$${formula.latex}$$`}</Markdown>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formula.description}
                            </p>
                            {formula.variables && (
                              <div className="text-xs text-muted-foreground border-t pt-2">
                                <Markdown>{formula.variables}</Markdown>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
