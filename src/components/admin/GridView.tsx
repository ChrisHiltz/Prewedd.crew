// src/components/admin/GridView.tsx
"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { ROLE_FILTER_OPTIONS } from "@/lib/utils/roles";

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
  couple_id: string | null;
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
  onShooterClick?: (shooterId: string) => void;
  onCoupleClick?: (coupleId: string) => void;
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
  onShooterClick,
  onCoupleClick,
}: GridViewProps) {

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
                      w.couple_id ? (
                        <button
                          key={w.wedding_id}
                          type="button"
                          onClick={() => onCoupleClick?.(w.couple_id!)}
                          className="mt-0.5 block truncate text-[10px] font-medium text-warning-text hover:text-primary hover:underline"
                        >
                          {w.couple_names}
                        </button>
                      ) : (
                        <span
                          key={w.wedding_id}
                          className="mt-0.5 block truncate text-[10px] font-medium text-warning-text"
                        >
                          {w.couple_names}
                        </span>
                      )
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
                    onClick={() => onShooterClick?.(shooter.id)}
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

    </div>
  );
}
