"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  User,
  Calendar,
  Clock,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface Profile {
  full_name: string;
  email: string;
  exam_date: string | null;
  subscription_tier: string;
  study_streak: number;
  total_study_minutes: number;
  created_at: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState("");
  const [examDate, setExamDate] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name || "");
        setExamDate(data.exam_date ? data.exam_date.split("T")[0] : "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          exam_date: examDate || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const daysUntilExam = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input value={profile?.email || ""} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed here
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              PE Exam Date
            </label>
            <Input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
            {daysUntilExam !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {daysUntilExam} days until your exam
              </p>
            )}
          </div>

          <Button onClick={saveProfile} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Study Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Study Statistics</CardTitle>
          <CardDescription>Your overall study progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <Flame className="h-6 w-6 mx-auto text-orange-500 mb-1" />
              <div className="text-2xl font-bold">{profile?.study_streak ?? 0}</div>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">
                {Math.round((profile?.total_study_minutes ?? 0) / 60)}h
              </div>
              <p className="text-xs text-muted-foreground">Total Study Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Your current plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge className="text-sm capitalize">
              {profile?.subscription_tier || "free"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Member since{" "}
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
