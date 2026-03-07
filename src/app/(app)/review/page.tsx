import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Spaced Repetition Review</h1>
        <p className="text-muted-foreground">
          Questions you missed or flagged, scheduled for optimal review timing
          using the SM-2 algorithm.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Today&apos;s Review Queue
          </CardTitle>
          <CardDescription>
            Questions due for review today based on your learning history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No questions due for review. Start practicing to build your review
            queue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
