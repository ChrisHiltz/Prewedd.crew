"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";

const SKILL_QUESTIONS = [
  { key: "getting_ready", label: "Getting-ready coverage" },
  { key: "details", label: "Detail shots (rings, florals, shoes, decor)" },
  { key: "ceremony", label: "Ceremony coverage" },
  { key: "portraits_posed", label: "Couple's portrait session (posed/directed)" },
  { key: "portraits_candid", label: "Candid portraits" },
  { key: "wedding_party", label: "Wedding party group photos" },
  { key: "family_formals", label: "Family formal portraits" },
  { key: "cocktail_hour", label: "Cocktail hour coverage" },
  { key: "reception", label: "Reception events (toasts, dances, cake)" },
  { key: "dance_floor", label: "Dance floor / party" },
  { key: "harsh_light", label: "Working in harsh/midday sun" },
  { key: "low_light", label: "Working in low light / indoor without flash" },
  { key: "flash", label: "Flash photography" },
  { key: "drone", label: "Drone or aerial (if applicable)" },
];

interface StepSkillsProps {
  profileId: string;
  onBack: () => void;
}

export function StepSkills({ profileId, onBack }: StepSkillsProps) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(SKILL_QUESTIONS.map((q) => [q.key, 3]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("shooter_profiles")
      .update({
        skill_scores: scores,
        onboarding_completed: true,
      })
      .eq("id", profileId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Skill Confidence
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Rate your confidence across wedding moments. 1 = least confident, 5 =
          where you thrive.
        </p>
      </div>

      <div className="space-y-5">
        {SKILL_QUESTIONS.map((q) => (
          <div key={q.key}>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {q.label}
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
              <span className="text-[10px] text-muted-foreground">1</span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {scores[q.key]}
              </span>
              <span className="text-[10px] text-muted-foreground">5</span>
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
              Complete
              <Check className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
