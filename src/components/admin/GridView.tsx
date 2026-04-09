// src/components/admin/GridView.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ROLE_FILTER_OPTIONS, ROLE_SHORT_LABELS } from "@/lib/utils/roles";
import { RoleIcon } from "@/components/ui/role-icon";
import { skillRating } from "@/lib/utils/scheduling";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Star } from "lucide-react";

export interface GridShooter {
  id: string;
  name: string;
  headshot_url: string | null;
  roles: string[];
  skill_scores: Record<string, number> | null;
  rates: Record<string, number> | null;
  is_employee: boolean;
}

export interface GridWeddingDate {
  date: string;
  couple_names: string;
  wedding_id: string;
}

export interface GridBlockedDate {
  shooter_id: string;
  date: string;
}

export interface GridAssignment {
  shooter_id: string;
  wedding_id: string;
  date: string;
  couple_initials: string;
}

interface GridViewProps {
  shooters: GridShooter[];
  weddingDates: GridWeddingDate[];
  blocked: GridBlockedDate[];
  assignments: GridAssignment[];
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
}

function formatDateHeader(dateStr: string): { dow: string; monthDay: string } {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { dow, monthDay };
}

export function GridView({
  shooters,
  weddingDates,
  blocked,
  assignments,
  roleFilter,
  onRoleFilterChange,
}: GridViewProps) {
  const [selectedShooter, setSelectedShooter] = useState<GridShooter | null>(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const filteredShooters = shooters.filter(
    (s) => !roleFilter || s.roles.includes(roleFilter)
  );

  const uniqueWeddingDates = [...new Set(weddingDates.map((w) => w.date))].sort();

  function getCellState(shooterId: string, dateStr: string) {
    const isPast = dateStr < todayStr;
    const assignment = assignments.find(
      (a) => a.shooter_id === shooterId && a.date === dateStr
    );
    const isBlocked = blocked.some(
      (b) => b.shooter_id === shooterId && b.date === dateStr
    );
    if (assignment) return { type: "assigned" as const, assignment };
    if (isBlocked) return { type: "blocked" as const };
    if (isPast) return { type: "past" as const };
    return { type: "available" as const };
  }

  function getWeddingsForDate(dateStr: string) {
    return weddingDates.filter((w) => w.date === dateStr);
  }

  if (uniqueWeddingDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
        <p className="text-sm font-medium text-foreground">No weddings in range</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Navigate to a different period, or create a wedding in Weddings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-success/30 bg-success/20" />
            <span className="text-[10px] text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-error/30 bg-error/20" />
            <span className="text-[10px] text-muted-foreground">Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-warning/30 bg-warning/20" />
            <span className="text-[10px] text-muted-foreground">Assigned</span>
          </div>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          {ROLE_FILTER_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-max border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-border bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Shooter
              </th>
              {uniqueWeddingDates.map((dateStr) => {
                const { dow, monthDay } = formatDateHeader(dateStr);
                const weddings = getWeddingsForDate(dateStr);
                return (
                  <th key={dateStr} className="min-w-[100px] border-b border-border px-1 py-1.5 text-center">
                    <div className="text-[9px] text-muted-foreground">{dow}</div>
                    <div className="text-[11px] font-medium text-foreground">{monthDay}</div>
                    {weddings.map((w) => (
                      <Link
                        key={w.wedding_id}
                        href={`/admin/weddings/${w.wedding_id}`}
                        className="mt-0.5 block truncate text-[10px] font-medium text-warning-text hover:text-primary hover:underline"
                      >
                        {w.couple_names}
                      </Link>
                    ))}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredShooters.map((shooter) => (
              <tr key={shooter.id} className="border-b border-border last:border-b-0">
                <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedShooter(shooter)}
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    <div className="relative size-6 shrink-0 overflow-hidden rounded-full bg-muted">
                      {shooter.headshot_url ? (
                        <Image src={shooter.headshot_url} alt={shooter.name} fill className="object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[8px] font-bold text-muted-foreground">
                          {shooter.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="truncate text-xs font-medium text-foreground hover:text-primary">
                      {shooter.name}
                    </span>
                  </button>
                </td>
                {uniqueWeddingDates.map((dateStr) => {
                  const state = getCellState(shooter.id, dateStr);
                  return (
                    <td key={dateStr} className="px-1 py-1.5 text-center">
                      <div
                        className={cn(
                          "mx-auto flex size-8 items-center justify-center rounded-md text-[9px] font-bold",
                          state.type === "available" && "bg-success/15 text-success",
                          state.type === "blocked" && "bg-error/15 text-error",
                          state.type === "assigned" && "bg-warning/20 text-warning-text",
                          state.type === "past" && "bg-muted/50 text-muted-foreground/30"
                        )}
                        title={
                          state.type === "assigned" && "assignment" in state
                            ? `Assigned: ${state.assignment.couple_initials}`
                            : state.type === "blocked" ? "Blocked"
                            : state.type === "available" ? "Available" : "Past"
                        }
                      >
                        {state.type === "assigned" && "assignment" in state
                          ? state.assignment.couple_initials
                          : state.type === "blocked" ? "×"
                          : state.type === "available" ? "✓" : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredShooters.length === 0 && (
              <tr>
                <td colSpan={uniqueWeddingDates.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No shooters match the filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {uniqueWeddingDates.length} wedding date{uniqueWeddingDates.length !== 1 ? "s" : ""} · {filteredShooters.length} shooter{filteredShooters.length !== 1 ? "s" : ""}
      </p>

      {/* Shooter info side panel */}
      <Sheet open={selectedShooter !== null} onOpenChange={(open) => { if (!open) setSelectedShooter(null); }}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto sm:max-w-sm">
          {selectedShooter && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {selectedShooter.headshot_url ? (
                      <Image src={selectedShooter.headshot_url} alt={selectedShooter.name} fill className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
                        {selectedShooter.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <SheetTitle className="text-base">{selectedShooter.name}</SheetTitle>
                    <span className={cn(
                      "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      selectedShooter.is_employee
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {selectedShooter.is_employee ? "W2 Employee" : "Contractor"}
                    </span>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {/* Roles */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedShooter.roles.map((role) => (
                      <span key={role} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                        <RoleIcon role={role} size="xs" />
                        <span className="text-[10px] font-medium">{ROLE_SHORT_LABELS[role as keyof typeof ROLE_SHORT_LABELS] ?? role}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skill Rating */}
                {selectedShooter.skill_scores && Object.keys(selectedShooter.skill_scores).length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skill Rating</h3>
                    <div className="flex items-center gap-1.5">
                      <Star className="size-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-semibold">{skillRating(selectedShooter.skill_scores).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">/ 5.0</span>
                    </div>
                  </div>
                )}

                {/* Rates */}
                {selectedShooter.rates && Object.keys(selectedShooter.rates).length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rates</h3>
                    <div className="space-y-1">
                      {Object.entries(selectedShooter.rates).map(([role, rate]) => (
                        <div key={role} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{ROLE_SHORT_LABELS[role as keyof typeof ROLE_SHORT_LABELS] ?? role}</span>
                          <span className="font-medium">${rate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
