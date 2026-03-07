import { GraduationCap, BookOpen, Brain, Target, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 animate-gradient">
        {/* Floating decorative shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-[15%] left-[10%] h-64 w-64 rounded-full bg-white/5 blur-3xl animate-float" />
          <div className="absolute bottom-[20%] right-[15%] h-48 w-48 rounded-full bg-white/8 blur-2xl animate-float-delayed" />
          <div className="absolute top-[60%] left-[50%] h-32 w-32 rounded-full bg-white/5 blur-2xl animate-float-slow" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">StructPrep</h1>
              <p className="text-xs text-white/60">PE Civil: Structures</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold leading-tight tracking-tight">
                Pass your PE exam
                <br />
                <span className="text-white/80">with confidence.</span>
              </h2>
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                AI-powered practice questions, adaptive learning, and real-time
                tutoring built for structural engineers.
              </p>
            </div>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[
                { icon: BookOpen, text: "800+ Practice Questions" },
                { icon: Brain, text: "AI Tutor & Explanations" },
                { icon: Target, text: "Adaptive Learning" },
                { icon: Shield, text: "NCEES Aligned" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2.5 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2.5 ring-1 ring-white/10"
                >
                  <Icon className="h-4 w-4 text-white/80 shrink-0" />
                  <span className="text-sm font-medium text-white/90">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom testimonial / social proof */}
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className="h-4 w-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-sm text-white/50 italic">
              &ldquo;The AI tutor helped me understand complex code provisions I&apos;d been struggling with for months.&rdquo;
            </p>
            <p className="text-xs text-white/40">
              &mdash; Structural Engineer, PE Candidate
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 dot-grid-bg opacity-50" />

        {/* Mobile logo (shown only on small screens) */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">StructPrep</h1>
            <p className="text-xs text-muted-foreground">PE Civil: Structures</p>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
