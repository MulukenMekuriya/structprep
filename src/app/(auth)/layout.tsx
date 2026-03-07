import { GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <div className="mb-8 flex items-center gap-2">
        <GraduationCap className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">StructPrep</h1>
          <p className="text-sm text-muted-foreground">
            PE Civil: Structures Exam Prep
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
