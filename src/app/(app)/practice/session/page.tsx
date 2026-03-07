import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PracticeSessionPage } from "./practice-session";

export default function PracticeSessionWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PracticeSessionPage />
    </Suspense>
  );
}
