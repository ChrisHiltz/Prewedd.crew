// src/components/admin/CouplePanel.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RoleIcon } from "@/components/ui/role-icon";
import { ROLE_SHORT_LABELS } from "@/lib/utils/roles";
import { AssignmentPillPopover, type PopoverAssignment } from "./AssignmentPillPopover";
import { getNeededRoles, getUnfilledRoles } from "@/lib/utils/scheduling";

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
    user_id: string | null;
    roles: string[] | null;
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
  assistant_roles: string[] | null;
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
  onAssignClick?: (weddingId: string, role: string) => void;
  onAssignmentsChanged?: () => void;
  /** Bump this counter to trigger a CouplePanel refetch from outside
   *  (e.g. after AssignSlideOut assigns a shooter). CouplePanel watches
   *  this alongside coupleId so it refetches even when coupleId hasn't
   *  changed. */
  refreshKey?: number;
}

// ─── Editable field ──────────────────────────────────────────────────────────

function EF({
  label,
  value,
  onSave,
  type = "text",
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string) => void;
  type?: "text" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setLocal(value ?? ""); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function save() {
    setEditing(false);
    const trimmed = local.trim();
    if (trimmed !== (value ?? "")) onSave(trimmed);
  }

  if (editing) {
    const cls = "w-full rounded border border-primary bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none";
    return (
      <div className="grid grid-cols-[110px_1fr] gap-1 py-[3px]">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {type === "textarea" ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === "Escape") { setLocal(value ?? ""); setEditing(false); } }}
            rows={2}
            className={cn(cls, "resize-none")}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setLocal(value ?? ""); setEditing(false); } }}
            className={cls}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[110px_1fr] gap-1 py-[3px]">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        onClick={() => setEditing(true)}
        className={cn(
          "cursor-pointer rounded px-0.5 text-[11px] hover:bg-muted",
          value ? "text-foreground" : "italic text-muted-foreground/50"
        )}
        title="Click to edit"
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Read-only field ─────────────────────────────────────────────────────────

function F({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-1 py-[3px]">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 py-[3px] text-[11px] text-primary hover:underline">
      <ExternalLink className="size-3 shrink-0" />
      {label}
    </a>
  );
}

function cap(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

function Section({ title, defaultOpen = true, count, children }: { title: string; defaultOpen?: boolean; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 py-2 text-left">
        {open ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {count != null && count > 0 && <span className="ml-auto rounded-full bg-muted px-1.5 text-[9px] font-medium text-muted-foreground">{count}</span>}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CouplePanel({ coupleId, onClose, onShooterClick, onAssignClick, onAssignmentsChanged, refreshKey }: CouplePanelProps) {
  const [couple, setCouple] = useState<CoupleData | null>(null);
  const [wedding, setWedding] = useState<FullWedding | null>(null);
  const [loading, setLoading] = useState(false);

  // Monotonic request-id guard: if a newer refetchCouple() call starts
  // before an older one finishes, the older one's setState calls are no-ops.
  const requestIdRef = useRef(0);

  const refetchCouple = useCallback(async () => {
    if (!coupleId) {
      setCouple(null);
      setWedding(null);
      return;
    }
    const myId = ++requestIdRef.current;
    setLoading(true);
    const supabase = createClient();
    const [coupleRes, weddingRes] = await Promise.all([
      supabase.from("couples").select("id, names, pronouns, description, energy_profile, best_day_ever, excited_about, nervous_about, notes").eq("id", coupleId).single(),
      supabase.from("weddings").select(`
        id, date, status, services, package, hours_of_coverage, add_ons,
        num_photographers, num_videographers, num_assistants, assistant_roles,
        venue_name, venue_address, ceremony_location, getting_ready_location,
        coordinator_name, coordinator_phone, planner_name, dress_code, meal_plan,
        wrap_time, file_deadline, gear_notes, team_notes,
        timeline_couple_url, timeline_internal_url, moodboard_url, family_checklist_url,
        team_confirmation_status,
        assignments(id, role, status, brief_read, quiz_passed, shooter_profiles(id, name, headshot_url, user_id, roles))
      `).eq("couple_id", coupleId).single(),
    ]);
    // Stale-response guard
    if (requestIdRef.current !== myId) return;
    if (coupleRes.data) setCouple(coupleRes.data as CoupleData);
    if (weddingRes.data) setWedding(weddingRes.data as unknown as FullWedding);
    setLoading(false);
  }, [coupleId]);

  useEffect(() => {
    refetchCouple();
  }, [refetchCouple, refreshKey]);

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function saveCouple(field: string, value: string) {
    if (!couple) return;
    const supabase = createClient();
    await supabase.from("couples").update({ [field]: value || null }).eq("id", couple.id);
    setCouple((prev) => prev ? { ...prev, [field]: value || null } : prev);
  }

  async function saveCoupleEnergy(key: string, value: string) {
    if (!couple) return;
    const supabase = createClient();
    const updated: Record<string, string> = {};
    if (couple.energy_profile) { for (const [k, v] of Object.entries(couple.energy_profile)) { if (v) updated[k] = v; } }
    if (value) updated[key] = value; else delete updated[key];
    await supabase.from("couples").update({ energy_profile: updated }).eq("id", couple.id);
    setCouple((prev) => prev ? { ...prev, energy_profile: updated } : prev);
  }

  async function saveWedding(field: string, value: string) {
    if (!wedding) return;
    const supabase = createClient();
    await supabase.from("weddings").update({ [field]: value || null }).eq("id", wedding.id);
    setWedding((prev) => prev ? { ...prev, [field]: value || null } as FullWedding : prev);
  }

  const isVisible = coupleId !== null;
  const w = wedding;
  const c = couple;

  // Compute unfilled roles for assign buttons
  const unfilledRoles = w ? getUnfilledRoles(
    getNeededRoles(w),
    w.assignments.map((a) => a.role)
  ) : [];

  return (
    <div className={cn(
      "fixed right-0 top-0 h-screen w-96 z-[55] border-l border-border bg-card shadow-xl overflow-y-auto transition-transform duration-200",
      isVisible ? "translate-x-0" : "translate-x-full"
    )}>
      <button type="button" onClick={onClose} className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="size-3.5" />
      </button>

      {loading && <div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Loading…</p></div>}

      {!loading && c && (
        <div className="px-3 pt-3 pb-4">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="mb-1 pr-6">
            <p className="text-base font-semibold text-foreground leading-tight">{c.names}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {c.pronouns && <span>{c.pronouns}</span>}
              {w && <><span>·</span><span>{new Date(w.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></>}
              {w?.venue_name && <><span>·</span><span>{w.venue_name}</span></>}
              {w?.status && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", w.status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{cap(w.status)}</span>
              )}
            </div>
          </div>

          {/* ── Staffing ────────────────────────────────────────────────── */}
          {w && (
            <Section title="Staffing" count={w.assignments.length}>
              {w.assignments.length > 0 && (() => {
                // Precompute popover-eligible assignments (non-null shooter_profiles).
                const popoverAssignments: PopoverAssignment[] = w.assignments
                  .filter((x) => x.shooter_profiles !== null)
                  .map((x) => ({
                    id: x.id,
                    role: x.role,
                    shooter_id: x.shooter_profiles!.id,
                    shooter_name: x.shooter_profiles!.name,
                    shooter_roles: x.shooter_profiles!.roles ?? [],
                    shooter_has_user: x.shooter_profiles!.user_id != null,
                  }));

                function handlePopoverSuccess() {
                  refetchCouple();
                  onAssignmentsChanged?.();
                }

                return (
                  <div className="space-y-1">
                    {w.assignments.map((a) => {
                      const sp = a.shooter_profiles;
                      if (!sp) {
                        // Null shooter_profiles — render fallback (no popover)
                        return (
                          <div key={a.id} className="flex w-full items-center gap-2 rounded px-1 py-1">
                            <div className="relative size-5 shrink-0 overflow-hidden rounded-full bg-muted">
                              <div className="flex size-full items-center justify-center text-[7px] font-bold text-muted-foreground">?</div>
                            </div>
                            <RoleIcon role={a.role} size="xs" />
                            <span className="flex-1 truncate text-[11px] font-medium text-muted-foreground">Unknown</span>
                          </div>
                        );
                      }

                      return (
                        <AssignmentPillPopover
                          key={a.id}
                          assignment={{
                            id: a.id,
                            role: a.role,
                            shooter_id: sp.id,
                            shooter_name: sp.name,
                            shooter_roles: sp.roles ?? [],
                            shooter_has_user: sp.user_id != null,
                          }}
                          weddingAssignments={popoverAssignments}
                          onViewProfile={(shooterId) => onShooterClick?.(shooterId)}
                          onAssignmentsChanged={handlePopoverSuccess}
                        >
                          <button type="button" className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/50">
                            <div className="relative size-5 shrink-0 overflow-hidden rounded-full bg-muted">
                              {sp.headshot_url ? <Image src={sp.headshot_url} alt={sp.name} fill className="object-cover" /> : <div className="flex size-full items-center justify-center text-[7px] font-bold text-muted-foreground">{sp.name.charAt(0)}</div>}
                            </div>
                            <RoleIcon role={a.role} size="xs" />
                            <span className="flex-1 truncate text-[11px] font-medium text-foreground">{sp.name}</span>
                            <span className="text-[9px] text-muted-foreground">{ROLE_SHORT_LABELS[a.role as keyof typeof ROLE_SHORT_LABELS] ?? a.role}</span>
                            <div className="flex gap-0.5">
                              <span className={cn("size-1.5 rounded-full", a.brief_read ? "bg-success" : "bg-muted-foreground/30")} title={a.brief_read ? "Brief read" : "Brief unread"} />
                              <span className={cn("size-1.5 rounded-full", a.quiz_passed ? "bg-success" : "bg-muted-foreground/30")} title={a.quiz_passed ? "Quiz passed" : "Quiz pending"} />
                            </div>
                          </button>
                        </AssignmentPillPopover>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Unfilled role assign buttons — same style as kanban cards */}
              {unfilledRoles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {unfilledRoles.map((role, i) => (
                    <button
                      key={`${role}-${i}`}
                      type="button"
                      onClick={() => w && onAssignClick?.(w.id, role)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                      <span>+</span>
                      <RoleIcon role={role} size="xs" />
                      <span>{ROLE_SHORT_LABELS[role as keyof typeof ROLE_SHORT_LABELS] ?? role}</span>
                    </button>
                  ))}
                </div>
              )}
              {w.assignments.length === 0 && unfilledRoles.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No roles configured.</p>
              )}
            </Section>
          )}

          {/* ── Service Details (editable) ───────────────────────────────── */}
          {w && (
            <Section title="Service Details">
              <EF label="Services" value={w.services} onSave={(v) => saveWedding("services", v)} />
              <EF label="Package" value={w.package} onSave={(v) => saveWedding("package", v)} />
              <EF label="Hours" value={w.hours_of_coverage} onSave={(v) => saveWedding("hours_of_coverage", v)} />
              <F label="Team Size" value={[w.num_photographers > 0 && `${w.num_photographers} photo`, w.num_videographers > 0 && `${w.num_videographers} video`, w.num_assistants > 0 && `${w.num_assistants} asst`].filter(Boolean).join(", ") || "—"} />
              {w.add_ons && w.add_ons.length > 0 && <F label="Add-ons" value={w.add_ons.join(", ")} />}
            </Section>
          )}

          {/* ── Locations (editable) ─────────────────────────────────────── */}
          {w && (
            <Section title="Locations">
              <EF label="Venue" value={w.venue_name} onSave={(v) => saveWedding("venue_name", v)} />
              <EF label="Address" value={w.venue_address} onSave={(v) => saveWedding("venue_address", v)} />
              <EF label="Ceremony" value={w.ceremony_location} onSave={(v) => saveWedding("ceremony_location", v)} />
              <EF label="Getting Ready" value={w.getting_ready_location} onSave={(v) => saveWedding("getting_ready_location", v)} />
            </Section>
          )}

          {/* ── Logistics (editable) ─────────────────────────────────────── */}
          {w && (
            <Section title="Logistics">
              <EF label="Coordinator" value={w.coordinator_name} onSave={(v) => saveWedding("coordinator_name", v)} />
              <EF label="Coord. Phone" value={w.coordinator_phone} onSave={(v) => saveWedding("coordinator_phone", v)} />
              <EF label="Planner" value={w.planner_name} onSave={(v) => saveWedding("planner_name", v)} />
              <EF label="Dress Code" value={w.dress_code} onSave={(v) => saveWedding("dress_code", v)} />
              <EF label="Meal Plan" value={w.meal_plan} onSave={(v) => saveWedding("meal_plan", v)} />
              <EF label="Wrap Time" value={w.wrap_time} onSave={(v) => saveWedding("wrap_time", v)} />
              <EF label="File Deadline" value={w.file_deadline} onSave={(v) => saveWedding("file_deadline", v)} />
              <EF label="Gear" value={w.gear_notes} onSave={(v) => saveWedding("gear_notes", v)} type="textarea" />
              <EF label="Team Notes" value={w.team_notes} onSave={(v) => saveWedding("team_notes", v)} type="textarea" />
            </Section>
          )}

          {/* ── Couple Profile (editable, collapsed by default) ──────────── */}
          <Section title="Couple Profile" defaultOpen={false}>
            <EF label="Description" value={c.description} onSave={(v) => saveCouple("description", v)} type="textarea" />
            {c.energy_profile && (
              <>
                <EF label="Energy" value={c.energy_profile.general_energy ? cap(c.energy_profile.general_energy) : null} onSave={(v) => saveCoupleEnergy("general_energy", v.toLowerCase())} />
                <EF label="Affection" value={c.energy_profile.affection_style ? cap(c.energy_profile.affection_style) : null} onSave={(v) => saveCoupleEnergy("affection_style", v.toLowerCase())} />
                <EF label="Stress" value={c.energy_profile.stress_style ? cap(c.energy_profile.stress_style) : null} onSave={(v) => saveCoupleEnergy("stress_style", v.toLowerCase())} />
              </>
            )}
            <EF label="Best Day Ever" value={c.best_day_ever} onSave={(v) => saveCouple("best_day_ever", v)} type="textarea" />
            <EF label="Excited About" value={c.excited_about} onSave={(v) => saveCouple("excited_about", v)} type="textarea" />
            <EF label="Nervous About" value={c.nervous_about} onSave={(v) => saveCouple("nervous_about", v)} type="textarea" />
            <EF label="Notes" value={c.notes} onSave={(v) => saveCouple("notes", v)} type="textarea" />
          </Section>

          {/* ── Documents (two columns) ──────────────────────────────────── */}
          {w && (w.timeline_couple_url || w.timeline_internal_url || w.moodboard_url || w.family_checklist_url) && (
            <Section title="Documents">
              <div className="grid grid-cols-2 gap-x-2">
                <DocLink label="Couple Timeline" url={w.timeline_couple_url} />
                <DocLink label="Internal Timeline" url={w.timeline_internal_url} />
                <DocLink label="Moodboard" url={w.moodboard_url} />
                <DocLink label="Family Checklist" url={w.family_checklist_url} />
              </div>
            </Section>
          )}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {w && (
            <div className="pt-3">
              <Link href={`/admin/weddings/${w.id}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                Open Full Record →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
