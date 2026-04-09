// src/components/admin/CouplePanel.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RoleIcon } from "@/components/ui/role-icon";
import { ROLE_SHORT_LABELS } from "@/lib/utils/roles";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoupleData {
  id: string;
  names: string;
  pronouns: string | null;
  description: string | null;
  energy_profile: Record<string, string> | null;
  best_day_ever: string | null;
  excited_about: string | null;
  nervous_about: string | null;
  notes: string | null;
}

interface WeddingAssignment {
  id: string;
  role: string;
  status: string;
  brief_read: boolean;
  quiz_passed: boolean;
  shooter_profiles: {
    id: string;
    name: string;
    headshot_url: string | null;
  } | null;
}

interface FullWedding {
  id: string;
  date: string;
  status: string | null;
  services: string | null;
  package: string | null;
  hours_of_coverage: string | null;
  add_ons: string[] | null;
  num_photographers: number;
  num_videographers: number;
  num_assistants: number;
  venue_name: string | null;
  venue_address: string | null;
  ceremony_location: string | null;
  getting_ready_location: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  planner_name: string | null;
  dress_code: string | null;
  meal_plan: string | null;
  wrap_time: string | null;
  file_deadline: string | null;
  gear_notes: string | null;
  team_notes: string | null;
  timeline_couple_url: string | null;
  timeline_internal_url: string | null;
  moodboard_url: string | null;
  family_checklist_url: string | null;
  team_confirmation_status: string | null;
  assignments: WeddingAssignment[];
}

interface CouplePanelProps {
  coupleId: string | null;
  onClose: () => void;
  onShooterClick?: (shooterId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cap(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

/** Two-column key-value row — renders nothing if value is empty */
function F({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-1 py-[3px]">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 py-[3px] text-[11px] text-primary hover:underline"
    >
      <ExternalLink className="size-3 shrink-0" />
      {label}
    </a>
  );
}

/** Collapsible section — open by default */
function Section({
  title,
  defaultOpen = true,
  count,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {count != null && count > 0 && (
          <span className="ml-auto rounded-full bg-muted px-1.5 text-[9px] font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CouplePanel({ coupleId, onClose, onShooterClick }: CouplePanelProps) {
  const [couple, setCouple] = useState<CoupleData | null>(null);
  const [wedding, setWedding] = useState<FullWedding | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coupleId) {
      setCouple(null);
      setWedding(null);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const supabase = createClient();

      const [coupleRes, weddingRes] = await Promise.all([
        supabase
          .from("couples")
          .select("id, names, pronouns, description, energy_profile, best_day_ever, excited_about, nervous_about, notes")
          .eq("id", coupleId!)
          .single(),
        supabase
          .from("weddings")
          .select(`
            id, date, status, services, package, hours_of_coverage, add_ons,
            num_photographers, num_videographers, num_assistants,
            venue_name, venue_address, ceremony_location, getting_ready_location,
            coordinator_name, coordinator_phone, planner_name, dress_code, meal_plan,
            wrap_time, file_deadline, gear_notes, team_notes,
            timeline_couple_url, timeline_internal_url, moodboard_url, family_checklist_url,
            team_confirmation_status,
            assignments(id, role, status, brief_read, quiz_passed, shooter_profiles(id, name, headshot_url))
          `)
          .eq("couple_id", coupleId!)
          .single(),
      ]);

      if (cancelled) return;
      if (coupleRes.data) setCouple(coupleRes.data as CoupleData);
      if (weddingRes.data) setWedding(weddingRes.data as unknown as FullWedding);
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [coupleId]);

  const isVisible = coupleId !== null;
  const w = wedding;
  const c = couple;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-screen w-[420px] z-30 border-l border-border bg-card shadow-xl overflow-y-auto transition-transform duration-200",
        isVisible ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      )}

      {!loading && c && (
        <div className="px-4 pt-3 pb-4">

          {/* ── Header (always visible, not collapsible) ────────────────── */}
          <div className="mb-1 pr-6">
            <p className="text-base font-semibold text-foreground leading-tight">{c.names}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {c.pronouns && <span>{c.pronouns}</span>}
              {w && (
                <>
                  <span>·</span>
                  <span>{new Date(w.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </>
              )}
              {w?.venue_name && (
                <>
                  <span>·</span>
                  <span>{w.venue_name}</span>
                </>
              )}
              {w?.status && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                  w.status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {cap(w.status)}
                </span>
              )}
            </div>
          </div>

          {/* ── Staffing (high priority — show first) ───────────────────── */}
          {w && (
            <Section title="Staffing" count={w.assignments.length}>
              {w.assignments.length > 0 ? (
                <div className="space-y-1">
                  {w.assignments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => a.shooter_profiles?.id && onShooterClick?.(a.shooter_profiles.id)}
                      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/50"
                    >
                      <div className="relative size-5 shrink-0 overflow-hidden rounded-full bg-muted">
                        {a.shooter_profiles?.headshot_url ? (
                          <Image src={a.shooter_profiles.headshot_url} alt={a.shooter_profiles.name} fill className="object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[7px] font-bold text-muted-foreground">
                            {a.shooter_profiles?.name?.charAt(0) ?? "?"}
                          </div>
                        )}
                      </div>
                      <RoleIcon role={a.role} size="xs" />
                      <span className="flex-1 truncate text-[11px] font-medium text-foreground">
                        {a.shooter_profiles?.name ?? "Unknown"}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {ROLE_SHORT_LABELS[a.role as keyof typeof ROLE_SHORT_LABELS] ?? a.role}
                      </span>
                      <div className="flex gap-0.5">
                        <span className={cn("size-1.5 rounded-full", a.brief_read ? "bg-success" : "bg-muted-foreground/30")} title={a.brief_read ? "Brief read" : "Brief unread"} />
                        <span className={cn("size-1.5 rounded-full", a.quiz_passed ? "bg-success" : "bg-muted-foreground/30")} title={a.quiz_passed ? "Quiz passed" : "Quiz pending"} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">No team assigned yet.</p>
              )}
            </Section>
          )}

          {/* ── Service Details ──────────────────────────────────────────── */}
          {w && (
            <Section title="Service Details">
              <F label="Services" value={w.services} />
              <F label="Package" value={w.package} />
              <F label="Hours" value={w.hours_of_coverage} />
              <div className="grid grid-cols-[120px_1fr] gap-1 py-[3px]">
                <span className="text-[11px] text-muted-foreground">Team Size</span>
                <span className="text-[11px] text-foreground">
                  {[
                    w.num_photographers > 0 && `${w.num_photographers} photo`,
                    w.num_videographers > 0 && `${w.num_videographers} video`,
                    w.num_assistants > 0 && `${w.num_assistants} asst`,
                  ].filter(Boolean).join(", ") || "—"}
                </span>
              </div>
              {w.add_ons && w.add_ons.length > 0 && <F label="Add-ons" value={w.add_ons.join(", ")} />}
            </Section>
          )}

          {/* ── Locations (two-col for venue name + address) ─────────────── */}
          {w && (w.venue_name || w.venue_address || w.ceremony_location || w.getting_ready_location) && (
            <Section title="Locations">
              <F label="Venue" value={w.venue_name} />
              <F label="Address" value={w.venue_address} />
              <F label="Ceremony" value={w.ceremony_location} />
              <F label="Getting Ready" value={w.getting_ready_location} />
            </Section>
          )}

          {/* ── Logistics ────────────────────────────────────────────────── */}
          {w && (w.coordinator_name || w.planner_name || w.dress_code || w.meal_plan || w.wrap_time || w.file_deadline || w.gear_notes || w.team_notes) && (
            <Section title="Logistics">
              <F label="Coordinator" value={w.coordinator_name} />
              <F label="Coord. Phone" value={w.coordinator_phone} />
              <F label="Planner" value={w.planner_name} />
              <F label="Dress Code" value={w.dress_code} />
              <F label="Meal Plan" value={w.meal_plan} />
              <F label="Wrap Time" value={w.wrap_time} />
              <F label="File Deadline" value={w.file_deadline} />
              <F label="Gear" value={w.gear_notes} />
              <F label="Team Notes" value={w.team_notes} />
            </Section>
          )}

          {/* ── Couple Profile ───────────────────────────────────────────── */}
          <Section title="Couple Profile" defaultOpen={false}>
            {c.description && (
              <p className="mb-1 text-[11px] text-foreground leading-relaxed">{c.description}</p>
            )}
            {c.energy_profile && (
              <>
                <F label="Energy" value={c.energy_profile.general_energy ? cap(c.energy_profile.general_energy) : null} />
                <F label="Affection" value={c.energy_profile.affection_style ? cap(c.energy_profile.affection_style) : null} />
                <F label="Stress" value={c.energy_profile.stress_style ? cap(c.energy_profile.stress_style) : null} />
              </>
            )}
            {c.best_day_ever && <F label="Best Day Ever" value={c.best_day_ever} />}
            {c.excited_about && <F label="Excited About" value={c.excited_about} />}
            {c.nervous_about && <F label="Nervous About" value={c.nervous_about} />}
            {c.notes && (
              <div className="mt-1">
                <span className="text-[10px] font-medium text-muted-foreground">Notes</span>
                <p className="mt-0.5 text-[11px] text-foreground leading-relaxed">{c.notes}</p>
              </div>
            )}
          </Section>

          {/* ── Documents ────────────────────────────────────────────────── */}
          {w && (w.timeline_couple_url || w.timeline_internal_url || w.moodboard_url || w.family_checklist_url) && (
            <Section title="Documents">
              <DocLink label="Couple Timeline" url={w.timeline_couple_url} />
              <DocLink label="Internal Timeline" url={w.timeline_internal_url} />
              <DocLink label="Moodboard" url={w.moodboard_url} />
              <DocLink label="Family Checklist" url={w.family_checklist_url} />
            </Section>
          )}

          {/* ── Footer link ──────────────────────────────────────────────── */}
          {w && (
            <div className="pt-3">
              <Link
                href={`/admin/weddings/${w.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Open Full Record →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
