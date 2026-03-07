import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NCEES_TOPICS, TOPIC_LABELS } from "@/types";
import { Calculator } from "lucide-react";
import Link from "next/link";

export default function FormulasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Formula Sheets</h1>
        <p className="text-muted-foreground">
          Key formulas organized by NCEES exam topic — rendered with LaTeX.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {NCEES_TOPICS.map((topic) => (
          <Link key={topic} href={`/formulas/${topic}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {TOPIC_LABELS[topic]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">Coming soon</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
