// src/components/admin/CouplePanel.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface CoupleData {
  id: string;
  names: string;
  pronouns: string | null;
  description: string | null;
  energy_profile: Record<string, string> | null;
  coverage_priorities: string[] | null;
  best_day_ever: string | null;
  excited_about: string | null;
  nervous_about: string | null;
  notes: string | null;
  created_at: string;
}

interface WeddingData {
  id: string;
  date: string;
  venue_name: string | null;
  status: string | null;
}

interface CouplePanelProps {
  coupleId: string | null;
  onClose: () => void;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-success/15 text-success",
  completed: "bg-info/15 text-info",
  cancelled: "bg-error/15 text-error",
};

export function CouplePanel({ coupleId, onClose }: CouplePanelProps) {
  const [couple, setCouple] = useState<CoupleData | null>(null);
  const [wedding, setWedding] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coupleId) {
      setCouple(null);
      setWedding(null);
      return;
    }

    let cancelled = false;

    async function fetchCouple() {
      setLoading(true);
      const supabase = createClient();

      const [coupleRes, weddingRes] = await Promise.all([
        supabase
          .from("couples")
          .select(
            "id, names, pronouns, description, energy_profile, coverage_priorities, best_day_ever, excited_about, nervous_about, notes, created_at"
          )
          .eq("id", coupleId!)
          .single(),
        supabase
          .from("weddings")
          .select("id, date, venue_name, status")
          .eq("couple_id", coupleId!)
          .single(),
      ]);

      if (cancelled) return;

      if (coupleRes.data) {
        setCouple(coupleRes.data as CoupleData);
      }
      if (weddingRes.data) {
        setWedding(weddingRes.data as WeddingData);
      }

      setLoading(false);
    }

    fetchCouple();

    return () => {
      cancelled = true;
    };
  }, [coupleId]);

  const isVisible = coupleId !== null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-screen w-[480px] z-30 border-l border-border bg-card shadow-xl overflow-y-auto transition-transform duration-200",
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

      {!loading && couple && (
        <div className="p-5 pt-4">
          {/* Header */}
          <div className="mb-5 pr-8">
            <p className="text-lg font-semibold text-foreground leading-tight">
              {couple.names}
            </p>
            {couple.pronouns && (
              <p className="mt-0.5 text-sm text-muted-foreground">{couple.pronouns}</p>
            )}
          </div>

          {/* Description */}
          {couple.description && (
            <div className="mb-5">
              <p className="text-sm text-foreground leading-relaxed">{couple.description}</p>
            </div>
          )}

          {/* Energy Profile */}
          {couple.energy_profile && (
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Energy Profile
              </h3>
              <div className="space-y-1.5">
                {couple.energy_profile.general_energy && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-32 shrink-0 text-[11px] text-muted-foreground">
                      General Energy
                    </span>
                    <span className="text-sm text-foreground">
                      {capitalize(couple.energy_profile.general_energy)}
                    </span>
                  </div>
                )}
                {couple.energy_profile.affection_style && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-32 shrink-0 text-[11px] text-muted-foreground">
                      Affection Style
                    </span>
                    <span className="text-sm text-foreground">
                      {capitalize(couple.energy_profile.affection_style)}
                    </span>
                  </div>
                )}
                {couple.energy_profile.stress_style && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-32 shrink-0 text-[11px] text-muted-foreground">
                      Stress Style
                    </span>
                    <span className="text-sm text-foreground">
                      {capitalize(couple.energy_profile.stress_style)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* About */}
          {(couple.best_day_ever || couple.excited_about || couple.nervous_about) && (
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                About
              </h3>
              <div className="space-y-2">
                {couple.best_day_ever && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Best Day Ever</p>
                    <p className="mt-0.5 text-sm text-foreground">{couple.best_day_ever}</p>
                  </div>
                )}
                {couple.excited_about && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Excited About</p>
                    <p className="mt-0.5 text-sm text-foreground">{couple.excited_about}</p>
                  </div>
                )}
                {couple.nervous_about && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Nervous About</p>
                    <p className="mt-0.5 text-sm text-foreground">{couple.nervous_about}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {couple.notes && (
            <div className="mb-5">
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </h3>
              <p className="text-sm text-foreground leading-relaxed">{couple.notes}</p>
            </div>
          )}

          {/* Wedding */}
          {wedding && (
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Wedding
              </h3>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Date</span>
                  <span className="text-sm text-foreground">
                    {new Date(wedding.date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {wedding.venue_name && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Venue</span>
                    <span className="text-sm text-foreground">{wedding.venue_name}</span>
                  </div>
                )}
                {wedding.status && (
                  <div className="flex items-baseline gap-2">
                    <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Status</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        STATUS_STYLES[wedding.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {capitalize(wedding.status)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          {wedding && (
            <div className="mt-6 border-t border-border pt-4">
              <Link
                href={`/admin/weddings/${wedding.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open Wedding Record →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
