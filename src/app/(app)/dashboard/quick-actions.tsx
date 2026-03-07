"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookOpen, Clock, MessageSquare } from "lucide-react";

export function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Practice
          </CardTitle>
          <CardDescription>
            Study questions by topic with adaptive difficulty
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/practice" className={cn(buttonVariants(), "w-full")}>
            Start Practice
          </Link>
        </CardContent>
      </Card>

      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Mock Exam
          </CardTitle>
          <CardDescription>
            80 questions, 9 hours — simulates the real PE exam
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/exam" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Start Exam
          </Link>
        </CardContent>
      </Card>

      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Tutor
          </CardTitle>
          <CardDescription>
            Ask questions — grounded in your structural codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/tutor" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Open Tutor
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
