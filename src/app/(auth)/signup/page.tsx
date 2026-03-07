"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const passwordStrength = password.length >= 8 ? "strong" : password.length >= 6 ? "medium" : "weak";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="glass rounded-2xl ring-1 ring-border/50 shadow-xl shadow-primary/5 p-8">
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
        <p className="text-sm text-muted-foreground">
          Start preparing for the PE Structures exam
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-sm text-destructive flex items-start gap-2">
            <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Mulu Mekuriya"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary/50 transition-colors"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary/50 transition-colors"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary/50 transition-colors"
            minLength={6}
            required
          />
          {password.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex gap-1 flex-1">
                <div className={`h-1 flex-1 rounded-full transition-colors ${
                  passwordStrength === "weak" ? "bg-red-400" : "bg-green-400"
                }`} />
                <div className={`h-1 flex-1 rounded-full transition-colors ${
                  passwordStrength === "medium" ? "bg-yellow-400" : passwordStrength === "strong" ? "bg-green-400" : "bg-muted"
                }`} />
                <div className={`h-1 flex-1 rounded-full transition-colors ${
                  passwordStrength === "strong" ? "bg-green-400" : "bg-muted"
                }`} />
              </div>
              {passwordStrength === "strong" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl text-sm font-semibold glow-primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background/50 px-3 text-muted-foreground">Already registered?</span>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
          {" "}to your account
        </p>
      </form>
    </div>
  );
}
