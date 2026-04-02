"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";

const PERSONALITY_QUESTIONS = [
  {
    key: "energy",
    question: "Energy level on wedding day",
    low: "Calm & steady",
    high: "High-energy & hype",
  },
  {
    key: "directing",
    question: "Directing style",
    low: "Hands-off / documentary",
    high: "Actively posing & directing",
  },
  {
    key: "communication",
    question: "Communication with couples",
    low: "Quiet & professional",
    high: "Chatty & warm",
  },
  {
    key: "pressure",
    question: "Schedule pressure response",
    low: "Stay calm, quietly adjust",
    high: "Vocalize, rally the group",
  },
  {
    key: "teamwork",
    question: "Working with second shooter",
    low: "Work independently",
    high: "Coordinate closely",
  },
  {
    key: "shy_couples",
    question: "With shy couples",
    low: "Give them space",
    high: "Actively draw them out",
  },
  {
    key: "philosophy",
    question: "Shooting philosophy",
    low: "Document naturally",
    high: "Create & direct moments",
  },
  {
    key: "downtime",
    question: "Downtime between events",
    low: "Hunt for candids & details",
    high: "Stay near couple / party",
  },
];

interface StepPersonalityProps {
  profileId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function StepPersonality({
  profileId,
  onComplete,
  onBack,
}: StepPersonalityProps) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(PERSONALITY_QUESTIONS.map((q) => [q.key, 3]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("shooter_profiles")
      .update({ personality_scores: scores })
      .eq("id", profileId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onComplete();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Personality Profile
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tell us about your working style. There are no right answers.
        </p>
      </div>

      <div className="space-y-6">
        {PERSONALITY_QUESTIONS.map((q) => (
          <div key={q.key}>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {q.question}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={scores[q.key]}
              onChange={(e) =>
                setScores((prev) => ({
                  ...prev,
                  [q.key]: parseInt(e.target.value, 10),
                }))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <div className="mt-1 flex justify-between">
              <span className="text-[10px] text-muted-foreground">
                {q.low}
              </span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {scores[q.key]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {q.high}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-10 flex-1 gap-2 bg-primary text-white hover:bg-primary-hover"
        >
          {saving ? "Saving..." : (
            <>
              Next
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
