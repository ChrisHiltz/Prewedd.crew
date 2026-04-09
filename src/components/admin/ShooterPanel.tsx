// src/components/admin/ShooterPanel.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RoleIcon } from "@/components/ui/role-icon";
import { ROLE_SHORT_LABELS } from "@/lib/utils/roles";

interface ShooterData {
  id: string;
  name: string;
  phone: string | null;
  pronouns: string | null;
  bio: string | null;
  headshot_url: string | null;
  is_employee: boolean;
  roles: string[];
  rates: Record<string, number> | null;
  skill_scores: Record<string, number> | null;
  personality_scores: Record<string, number> | null;
  onboarding_completed: boolean;
  created_at: string;
  user_id: string;
  email?: string;
}

const SKILL_SCORE_KEYS = [
  "getting_ready",
  "details",
  "ceremony",
  "portraits_posed",
  "portraits_candid",
  "wedding_party",
  "family_formals",
  "cocktail_hour",
  "reception",
  "dance_floor",
  "harsh_light",
  "low_light",
  "flash",
  "drone",
] as const;

const SKILL_SCORE_LABELS: Record<string, string> = {
  getting_ready: "Getting Ready",
  details: "Details",
  ceremony: "Ceremony",
  portraits_posed: "Portraits (Posed)",
  portraits_candid: "Portraits (Candid)",
  wedding_party: "Wedding Party",
  family_formals: "Family Formals",
  cocktail_hour: "Cocktail Hour",
  reception: "Reception",
  dance_floor: "Dance Floor",
  harsh_light: "Harsh Light",
  low_light: "Low Light",
  flash: "Flash",
  drone: "Drone",
};

const PERSONALITY_SCORE_KEYS = [
  "energy",
  "directing",
  "communication",
  "pressure",
  "teamwork",
  "shy_couples",
  "philosophy",
  "downtime",
] as const;

const PERSONALITY_SCORE_LABELS: Record<string, string> = {
  energy: "Energy",
  directing: "Directing",
  communication: "Communication",
  pressure: "Pressure",
  teamwork: "Teamwork",
  shy_couples: "Shy Couples",
  philosophy: "Philosophy",
  downtime: "Downtime",
};

function ScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/60"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface ShooterPanelProps {
  shooterId: string | null;
  onClose: () => void;
}

export function ShooterPanel({ shooterId, onClose }: ShooterPanelProps) {
  const [shooter, setShooter] = useState<ShooterData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shooterId) {
      setShooter(null);
      return;
    }

    let cancelled = false;

    async function fetchShooter() {
      setLoading(true);
      const supabase = createClient();

      const { data: profile } = await supabase
        .from("shooter_profiles")
        .select(
          "id, name, phone, pronouns, bio, headshot_url, is_employee, roles, rates, skill_scores, personality_scores, onboarding_completed, created_at, user_id"
        )
        .eq("id", shooterId!)
        .single();

      if (!profile || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      let email: string | undefined;
      if (profile.user_id) {
        const { data: userData } = await supabase
          .from("users")
          .select("email")
          .eq("id", profile.user_id)
          .single();
        if (userData && !cancelled) {
          email = userData.email;
        }
      }

      if (!cancelled) {
        setShooter({ ...(profile as ShooterData), email });
        setLoading(false);
      }
    }

    fetchShooter();

    return () => {
      cancelled = true;
    };
  }, [shooterId]);

  const isVisible = shooterId !== null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-screen w-96 z-[60] border-l border-border bg-card shadow-xl overflow-y-auto transition-transform duration-200",
        isVisible ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Close panel"
      >
        <X className="size-4" />
      </button>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      )}

      {!loading && shooter && (
        <div className="p-5 pt-4">
          {/* Header */}
          <div className="mb-5 flex items-start gap-3 pr-8">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-muted">
              {shooter.headshot_url ? (
                <Image
                  src={shooter.headshot_url}
                  alt={shooter.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-xl font-bold text-muted-foreground">
                  {shooter.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground leading-tight">
                {shooter.name}
              </p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                  shooter.is_employee
                    ? "bg-blue-100 text-blue-700"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {shooter.is_employee ? "W2 Employee" : "Contractor"}
              </span>
            </div>
          </div>

          {/* Contact */}
          <div className="mb-5 space-y-1.5">
            {shooter.email && (
              <div className="flex items-baseline gap-2">
                <span className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </span>
                <span className="text-sm text-foreground break-all">{shooter.email}</span>
              </div>
            )}
            {shooter.phone && (
              <div className="flex items-baseline gap-2">
                <span className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Phone
                </span>
                <span className="text-sm text-foreground">{shooter.phone}</span>
              </div>
            )}
            {shooter.pronouns && (
              <div className="flex items-baseline gap-2">
                <span className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pronouns
                </span>
                <span className="text-sm text-foreground">{shooter.pronouns}</span>
              </div>
            )}
          </div>

          {/* Bio */}
          {shooter.bio && (
            <div className="mb-5">
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bio
              </h3>
              <p className="text-sm text-foreground leading-relaxed">{shooter.bio}</p>
            </div>
          )}

          {/* Roles */}
          {shooter.roles && shooter.roles.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Roles
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {shooter.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5"
                  >
                    <RoleIcon role={role} size="xs" />
                    <span className="text-[10px] font-medium">
                      {ROLE_SHORT_LABELS[role] ?? role}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rates */}
          {shooter.rates && Object.keys(shooter.rates).length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Rates
              </h3>
              <div className="space-y-1">
                {Object.entries(shooter.rates).map(([role, rate]) => (
                  <div key={role} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {ROLE_SHORT_LABELS[role] ?? role}
                    </span>
                    <span className="font-medium">${rate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skill Scores */}
          {shooter.skill_scores && Object.keys(shooter.skill_scores).length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Skill Scores
              </h3>
              <div className="space-y-2">
                {SKILL_SCORE_KEYS.filter((key) => shooter.skill_scores![key] !== undefined).map(
                  (key) => {
                    const val = shooter.skill_scores![key] ?? 0;
                    return (
                      <div key={key}>
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {SKILL_SCORE_LABELS[key]}
                          </span>
                          <span className="text-[11px] font-medium text-foreground">
                            {val}/5
                          </span>
                        </div>
                        <ScoreBar value={val} />
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Personality Scores */}
          {shooter.personality_scores &&
            Object.keys(shooter.personality_scores).length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Personality Scores
                </h3>
                <div className="space-y-2">
                  {PERSONALITY_SCORE_KEYS.filter(
                    (key) => shooter.personality_scores![key] !== undefined
                  ).map((key) => {
                    const val = shooter.personality_scores![key] ?? 0;
                    return (
                      <div key={key}>
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {PERSONALITY_SCORE_LABELS[key]}
                          </span>
                          <span className="text-[11px] font-medium text-foreground">
                            {val}/5
                          </span>
                        </div>
                        <ScoreBar value={val} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Footer */}
          <div className="mt-6 border-t border-border pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Onboarding</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  shooter.onboarding_completed
                    ? "bg-success/15 text-success"
                    : "bg-warning/15 text-warning-text"
                )}
              >
                {shooter.onboarding_completed ? "Complete" : "Incomplete"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Member since</span>
              <span className="text-[10px] text-foreground">
                {new Date(shooter.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="pt-1">
              <Link
                href="/admin/roster"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open in Roster
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
