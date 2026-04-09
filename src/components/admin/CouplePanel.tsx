// src/components/admin/CouplePanel.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RoleIcon } from "@/components/ui/role-icon";
import { ROLE_SHORT_LABELS } from "@/lib/utils/roles";

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
  // Service Details
  services: string | null;
  package: string | null;
  hours_of_coverage: string | null;
  add_ons: string[] | null;
  num_photographers: number;
  num_videographers: number;
  num_assistants: number;
  // Locations
  venue_name: string | null;
  venue_address: string | null;
  ceremony_location: string | null;
  getting_ready_location: string | null;
  // Logistics
  coordinator_name: string | null;
  coordinator_phone: string | null;
  planner_name: string | null;
  dress_code: string | null;
  meal_plan: string | null;
  wrap_time: string | null;
  file_deadline: string | null;
  gear_notes: string | null;
  team_notes: string | null;
  // Documents
  timeline_couple_url: string | null;
  timeline_internal_url: string | null;
  moodboard_url: string | null;
  family_checklist_url: string | null;
  // Staffing
  team_confirmation_status: string | null;
  assignments: WeddingAssignment[];
}

interface CouplePanelProps {
  coupleId: string | null;
  onClose: () => void;
  onShooterClick?: (shooterId: string) => void;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-36 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
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
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <ExternalLink className="size-3" />
      {label}
    </a>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

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
        className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <div className="space-y-5 p-5 pt-4">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="pr-8">
            <p className="text-lg font-semibold text-foreground leading-tight">{couple.names}</p>
            {couple.pronouns && (
              <p className="mt-0.5 text-sm text-muted-foreground">{couple.pronouns}</p>
            )}
            {wedding && (
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(wedding.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                {wedding.venue_name ? ` · ${wedding.venue_name}` : ""}
              </p>
            )}
          </div>

          {/* ── Couple Profile ───────────────────────────────────────────── */}
          <div>
            <SectionHeader>Couple Profile</SectionHeader>
            {couple.description && (
              <p className="mb-2 text-sm text-foreground leading-relaxed">{couple.description}</p>
            )}
            {couple.energy_profile && (
              <div className="space-y-1">
                <Row label="General Energy" value={couple.energy_profile.general_energy ? capitalize(couple.energy_profile.general_energy) : null} />
                <Row label="Affection Style" value={couple.energy_profile.affection_style ? capitalize(couple.energy_profile.affection_style) : null} />
                <Row label="Stress Style" value={couple.energy_profile.stress_style ? capitalize(couple.energy_profile.stress_style) : null} />
              </div>
            )}
            {couple.best_day_ever && (
              <div className="mt-2">
                <p className="text-[11px] font-medium text-muted-foreground">Best Day Ever</p>
                <p className="mt-0.5 text-sm text-foreground">{couple.best_day_ever}</p>
              </div>
            )}
            {couple.excited_about && (
              <div className="mt-2">
                <p className="text-[11px] font-medium text-muted-foreground">Excited About</p>
                <p className="mt-0.5 text-sm text-foreground">{couple.excited_about}</p>
              </div>
            )}
            {couple.nervous_about && (
              <div className="mt-2">
                <p className="text-[11px] font-medium text-muted-foreground">Nervous About</p>
                <p className="mt-0.5 text-sm text-foreground">{couple.nervous_about}</p>
              </div>
            )}
            {couple.notes && (
              <div className="mt-2">
                <p className="text-[11px] font-medium text-muted-foreground">Notes</p>
                <p className="mt-0.5 text-sm text-foreground">{couple.notes}</p>
              </div>
            )}
          </div>

          {wedding && (
            <>
              {/* ── Service Details ────────────────────────────────────────── */}
              <div>
                <SectionHeader>Service Details</SectionHeader>
                <div className="space-y-1">
                  <Row label="Services" value={wedding.services} />
                  <Row label="Package" value={wedding.package} />
                  <Row label="Hours of Coverage" value={wedding.hours_of_coverage} />
                  <Row label="Photographers" value={wedding.num_photographers > 0 ? wedding.num_photographers : null} />
                  <Row label="Videographers" value={wedding.num_videographers > 0 ? wedding.num_videographers : null} />
                  <Row label="Assistants" value={wedding.num_assistants > 0 ? wedding.num_assistants : null} />
                  {wedding.add_ons && wedding.add_ons.length > 0 && (
                    <Row label="Add-ons" value={wedding.add_ons.join(", ")} />
                  )}
                </div>
              </div>

              {/* ── Locations ─────────────────────────────────────────────── */}
              {(wedding.venue_name || wedding.venue_address || wedding.ceremony_location || wedding.getting_ready_location) && (
                <div>
                  <SectionHeader>Locations</SectionHeader>
                  <div className="space-y-1">
                    <Row label="Venue" value={wedding.venue_name} />
                    <Row label="Address" value={wedding.venue_address} />
                    <Row label="Ceremony" value={wedding.ceremony_location} />
                    <Row label="Getting Ready" value={wedding.getting_ready_location} />
                  </div>
                </div>
              )}

              {/* ── Logistics ─────────────────────────────────────────────── */}
              {(wedding.coordinator_name || wedding.planner_name || wedding.dress_code || wedding.meal_plan || wedding.wrap_time || wedding.file_deadline || wedding.gear_notes || wedding.team_notes) && (
                <div>
                  <SectionHeader>Logistics</SectionHeader>
                  <div className="space-y-1">
                    <Row label="Coordinator" value={wedding.coordinator_name} />
                    <Row label="Coordinator Phone" value={wedding.coordinator_phone} />
                    <Row label="Planner" value={wedding.planner_name} />
                    <Row label="Dress Code" value={wedding.dress_code} />
                    <Row label="Meal Plan" value={wedding.meal_plan} />
                    <Row label="Wrap Time" value={wedding.wrap_time} />
                    <Row label="File Deadline" value={wedding.file_deadline} />
                    <Row label="Gear Notes" value={wedding.gear_notes} />
                    <Row label="Team Notes" value={wedding.team_notes} />
                  </div>
                </div>
              )}

              {/* ── Staffing ──────────────────────────────────────────────── */}
              <div>
                <SectionHeader>Staffing</SectionHeader>
                {wedding.team_confirmation_status && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{wedding.team_confirmation_status}</span>
                  </p>
                )}
                {wedding.assignments.length > 0 ? (
                  <div className="space-y-1.5">
                    {wedding.assignments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => a.shooter_profiles?.id && onShooterClick?.(a.shooter_profiles.id)}
                        className="flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left hover:bg-muted/50"
                      >
                        <div className="relative size-6 shrink-0 overflow-hidden rounded-full bg-muted">
                          {a.shooter_profiles?.headshot_url ? (
                            <Image src={a.shooter_profiles.headshot_url} alt={a.shooter_profiles.name} fill className="object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[8px] font-bold text-muted-foreground">
                              {a.shooter_profiles?.name?.charAt(0) ?? "?"}
                            </div>
                          )}
                        </div>
                        <RoleIcon role={a.role} size="xs" />
                        <span className="flex-1 text-sm font-medium text-foreground">
                          {a.shooter_profiles?.name ?? "Unknown"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {ROLE_SHORT_LABELS[a.role as keyof typeof ROLE_SHORT_LABELS] ?? a.role}
                        </span>
                        <div className="flex gap-1">
                          <span className={cn("size-1.5 rounded-full", a.brief_read ? "bg-success" : "bg-muted-foreground/30")} title={a.brief_read ? "Brief read" : "Brief unread"} />
                          <span className={cn("size-1.5 rounded-full", a.quiz_passed ? "bg-success" : "bg-muted-foreground/30")} title={a.quiz_passed ? "Quiz passed" : "Quiz pending"} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No team assigned yet.</p>
                )}
              </div>

              {/* ── Documents ─────────────────────────────────────────────── */}
              {(wedding.timeline_couple_url || wedding.timeline_internal_url || wedding.moodboard_url || wedding.family_checklist_url) && (
                <div>
                  <SectionHeader>Documents</SectionHeader>
                  <div className="space-y-1.5">
                    <DocLink label="Couple Timeline" url={wedding.timeline_couple_url} />
                    <DocLink label="Internal Timeline" url={wedding.timeline_internal_url} />
                    <DocLink label="Moodboard" url={wedding.moodboard_url} />
                    <DocLink label="Family Checklist" url={wedding.family_checklist_url} />
                  </div>
                </div>
              )}

              {/* ── Footer ────────────────────────────────────────────────── */}
              <div className="border-t border-border pt-4">
                <Link
                  href={`/admin/weddings/${wedding.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Open Wedding Record →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
