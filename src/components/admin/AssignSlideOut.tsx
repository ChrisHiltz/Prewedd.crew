// src/components/admin/AssignSlideOut.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getWeekendWindow, skillRating } from "@/lib/utils/scheduling";
import { ROLE_LABELS } from "@/lib/utils/roles";
import { RoleIcon } from "@/components/ui/role-icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayStatus =
  | { type: "free" }
  | { type: "blocked" }
  | { type: "booked"; wedding_id: string; couple_name: string }
  | { type: "on_team" };

type SortOption = "employees_first" | "skill_rating" | "lowest_rate";

interface ShooterRow {
  id: string;
  name: string;
  headshot_url: string | null;
  is_employee: boolean;
  roles: string[];
  rates: Record<string, number> | null;
  skill_scores: Record<string, number> | null;
  // Availability for each of the 3 weekend days [prev, wedding, next]
  dayStatuses: [DayStatus, DayStatus, DayStatus];
}

export interface AssignSlideOutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The wedding to assign to */
  weddingId: string;
  weddingDate: string;
  coupleNames: string;
  /** The role slot being filled */
  role: string;
  /** Called after a successful assign or swap so the parent can refresh */
  onAssigned: () => void;
  /** Opens the global ShooterPanel for this shooter */
  onShooterClick?: (shooterId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDayHeader(dateStr: string): { dow: string; monthDay: string } {
  const d = new Date(dateStr + "T12:00:00");
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short" }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function rateForRole(
  rates: Record<string, number> | null,
  role: string
): number | null {
  if (!rates) return null;
  return rates[role] ?? null;
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({ status }: { status: DayStatus }) {
  if (status.type === "free") {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded bg-success/15 text-[10px] font-bold text-success" title="Free">
        ✓
      </span>
    );
  }
  if (status.type === "blocked") {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded bg-error/15 text-[10px] font-bold text-error" title="Blocked">
        ×
      </span>
    );
  }
  if (status.type === "on_team") {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded bg-info/15 text-[10px] font-bold text-info" title="On this team">
        ★
      </span>
    );
  }
  // booked
  return (
    <span className="inline-flex size-6 items-center justify-center rounded bg-warning/20 text-[10px] font-bold text-warning-text" title={`Booked: ${status.couple_name}`}>
      B
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AssignSlideOut({
  open,
  onOpenChange,
  weddingId,
  weddingDate,
  coupleNames,
  role,
  onAssigned,
  onShooterClick,
}: AssignSlideOutProps) {
  const [shooters, setShooters] = useState<ShooterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortOption>("employees_first");
  const [assigning, setAssigning] = useState<string | null>(null); // shooter id being assigned
  const [error, setError] = useState<string | null>(null);

  const weekendDays = useMemo(() => getWeekendWindow(weddingDate), [weddingDate]); // [prev, wedding, next]

  // ── Load shooters + their availability for the weekend window ──────────────

  const loadShooters = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const [prevDay, weddingDay, nextDay] = weekendDays;
    const rangeStart = prevDay;
    const rangeEnd = nextDay;

    // 1. All shooter profiles that hold this role
    const { data: profiles, error: profilesErr } = await supabase
      .from("shooter_profiles")
      .select("id, name, headshot_url, is_employee, roles, rates, skill_scores")
      .contains("roles", [role])
      .order("name");

    if (profilesErr || !profiles) {
      setError("Failed to load shooters.");
      setLoading(false);
      return;
    }

    const shooterIds = profiles.map((p) => p.id);

    // 2. Blocked dates for this weekend window
    const { data: blockedRows } = await supabase
      .from("blocked_dates")
      .select("shooter_id, date")
      .in("shooter_id", shooterIds)
      .gte("date", rangeStart)
      .lte("date", rangeEnd);

    // 3. Assignments on these days — include wedding_id and couple name
    const { data: assignmentRows } = await supabase
      .from("assignments")
      .select("shooter_id, wedding_id, weddings(date, couples(names))")
      .in("shooter_id", shooterIds);

    // Filter assignments to our weekend window
    interface RawAssignment {
      shooter_id: string;
      wedding_id: string;
      weddings: { date: string; couples: { names: string } | null } | null;
    }

    const windowAssignments: {
      shooter_id: string;
      wedding_id: string;
      date: string;
      couple_name: string;
    }[] = [];

    for (const a of (assignmentRows ?? []) as unknown as RawAssignment[]) {
      const w = a.weddings;
      if (!w) continue;
      if (w.date < rangeStart || w.date > rangeEnd) continue;
      windowAssignments.push({
        shooter_id: a.shooter_id,
        wedding_id: a.wedding_id,
        date: w.date,
        couple_name: w.couples?.names ?? "TBD",
      });
    }

    // Build rows
    const rows: ShooterRow[] = profiles.map((p) => {
      const dayStatuses: [DayStatus, DayStatus, DayStatus] = [
        "free",
        "free",
        "free",
      ].map((_, i) => {
        const day = weekendDays[i];
        const isWeddingDay = i === 1;

        // Check if this shooter is already on THIS wedding (wedding day only)
        if (isWeddingDay) {
          const onThisWedding = windowAssignments.some(
            (a) =>
              a.shooter_id === p.id &&
              a.date === day &&
              a.wedding_id === weddingId
          );
          if (onThisWedding) return { type: "on_team" } as DayStatus;
        }

        // Check blocked
        const isBlocked = (blockedRows ?? []).some(
          (b) => b.shooter_id === p.id && b.date === day
        );
        if (isBlocked) return { type: "blocked" } as DayStatus;

        // Check booked on a different wedding
        const assignment = windowAssignments.find(
          (a) =>
            a.shooter_id === p.id &&
            a.date === day &&
            a.wedding_id !== weddingId
        );
        if (assignment) {
          return {
            type: "booked",
            wedding_id: assignment.wedding_id,
            couple_name: assignment.couple_name,
          } as DayStatus;
        }

        return { type: "free" } as DayStatus;
      }) as [DayStatus, DayStatus, DayStatus];

      return {
        id: p.id,
        name: p.name,
        headshot_url: p.headshot_url,
        is_employee: p.is_employee ?? false,
        roles: p.roles ?? [],
        rates: p.rates as Record<string, number> | null,
        skill_scores: p.skill_scores as Record<string, number> | null,
        dayStatuses,
      };
    });

    setShooters(rows);
    setLoading(false);
  }, [open, weddingId, weddingDate, role, weekendDays]);

  useEffect(() => {
    loadShooters();
  }, [loadShooters]);

  // ── Sort ───────────────────────────────────────────────────────────────────

  const sorted = [...shooters].sort((a, b) => {
    if (sort === "employees_first") {
      if (a.is_employee !== b.is_employee)
        return a.is_employee ? -1 : 1;
      return a.name.localeCompare(b.name);
    }
    if (sort === "skill_rating") {
      return skillRating(b.skill_scores) - skillRating(a.skill_scores);
    }
    if (sort === "lowest_rate") {
      const ra = rateForRole(a.rates, role) ?? Infinity;
      const rb = rateForRole(b.rates, role) ?? Infinity;
      return ra - rb;
    }
    return 0;
  });

  // ── Assign / Swap ──────────────────────────────────────────────────────────

  async function handleAssign(
    shooterId: string,
    swapFromWeddingId?: string
  ) {
    setAssigning(shooterId);
    setError(null);

    const body: Record<string, string> = {
      wedding_id: weddingId,
      shooter_id: shooterId,
      role,
    };
    if (swapFromWeddingId) {
      body.swap_from_wedding_id = swapFromWeddingId;
    }

    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { message?: string; error?: string };
        setError(json.message ?? json.error ?? "Assignment failed.");
      } else {
        onAssigned();
        onOpenChange(false);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAssigning(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const [prevDay, weddingDay, nextDay] = weekendDays;
  const prevHeader = formatDayHeader(prevDay);
  const weddingHeader = formatDayHeader(weddingDay);
  const nextHeader = formatDayHeader(nextDay);

  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="border-b border-border pb-3">
          <SheetTitle className="flex items-center gap-2">
            <RoleIcon role={role} size="md" />
            <span>Add {roleLabel}</span>
          </SheetTitle>
          <SheetDescription>
            {coupleNames} &mdash; {weddingHeader.dow}, {weddingHeader.monthDay}
          </SheetDescription>
        </SheetHeader>

        {/* Sort control */}
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${sorted.length} shooter${sorted.length !== 1 ? "s" : ""}`}
          </span>
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortOption)}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employees_first">Employees first</SelectItem>
              <SelectItem value="skill_rating">Skill rating</SelectItem>
              <SelectItem value="lowest_rate">Lowest rate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 rounded-md bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}

        {/* Shooter list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-muted-foreground">Loading shooters…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm font-medium text-foreground">No shooters found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No active shooters hold the {roleLabel} role.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {/* Day column headers */}
              <div className="mb-1 flex items-center">
                {/* Name column spacer */}
                <div className="flex-1" />
                {/* Day headers */}
                <div className="flex gap-1">
                  {[prevHeader, weddingHeader, nextHeader].map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-12 text-center",
                        i === 1 && "font-semibold text-foreground"
                      )}
                    >
                      <div className="text-[8px] uppercase tracking-wide text-muted-foreground">
                        {h.dow}
                      </div>
                      <div
                        className={cn(
                          "text-[9px]",
                          i === 1
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {h.monthDay}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Action column spacer */}
                <div className="w-20" />
              </div>

              {sorted.map((shooter) => {
                const weddingDayStatus = shooter.dayStatuses[1];
                const isOnTeam = weddingDayStatus.type === "on_team";
                const isWeddingDayBlocked = weddingDayStatus.type === "blocked";
                const isWeddingDayBooked = weddingDayStatus.type === "booked";
                const swapWeddingId =
                  isWeddingDayBooked ? weddingDayStatus.wedding_id : undefined;

                const rate = rateForRole(shooter.rates, role);
                const skill = skillRating(shooter.skill_scores);
                const isLoading = assigning === shooter.id;

                // Display name: first name + last initial
                const nameParts = shooter.name.split(" ");
                const displayName = nameParts.length > 1
                  ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
                  : nameParts[0];

                return (
                  <div
                    key={shooter.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 transition-colors",
                      isOnTeam && "border-info/40 bg-info/5",
                      isWeddingDayBlocked && "opacity-50"
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted">
                      {shooter.headshot_url ? (
                        <Image src={shooter.headshot_url} alt={shooter.name} fill className="object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[8px] font-bold text-muted-foreground">
                          {shooter.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onShooterClick?.(shooter.id)}
                        className="truncate text-xs font-medium text-foreground hover:text-primary"
                        title={shooter.name}
                      >
                        {displayName}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "rounded-full px-1 py-0 text-[7px] font-semibold",
                          shooter.is_employee ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {shooter.is_employee ? "W2" : "Contr."}
                        </span>
                        {skill > 0 && <span className="text-[8px] text-muted-foreground">★{skill.toFixed(1)}</span>}
                        {rate !== null && <span className="text-[8px] text-muted-foreground">${rate}</span>}
                      </div>
                    </div>

                    {/* Day cells */}
                    <div className="flex gap-0.5 shrink-0">
                      {shooter.dayStatuses.map((status, i) => (
                        <DayCell key={i} status={status} />
                      ))}
                    </div>

                    {/* Action */}
                    <div className="w-12 shrink-0 text-right">
                      {isOnTeam ? (
                        <span className="text-[8px] font-medium text-info">On team</span>
                      ) : isWeddingDayBooked ? (
                        <button type="button" onClick={() => handleAssign(shooter.id, swapWeddingId)} disabled={isLoading} className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold text-warning-text hover:bg-warning/30 disabled:opacity-50">
                          {isLoading ? "…" : "Swap"}
                        </button>
                      ) : isWeddingDayBlocked ? (
                        <span className="text-[8px] text-muted-foreground">Blocked</span>
                      ) : (
                        <button type="button" onClick={() => handleAssign(shooter.id)} disabled={isLoading} className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                          {isLoading ? "…" : "Add"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
