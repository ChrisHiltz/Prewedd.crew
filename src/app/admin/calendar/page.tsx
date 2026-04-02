"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ROLES = [
  { value: "", label: "All Roles" },
  { value: "lead_photo", label: "Lead Photographer" },
  { value: "second_photo", label: "Second Photographer" },
  { value: "lead_video", label: "Lead Videographer" },
  { value: "second_video", label: "Second Videographer" },
  { value: "photobooth", label: "Photobooth Operator" },
  { value: "drone", label: "Drone Operator" },
];

interface Shooter {
  id: string;
  name: string;
  headshot_url: string | null;
  roles: string[];
}

interface WeddingDate {
  date: string;
  couple_names: string;
  wedding_id: string;
}

interface BlockedDate {
  shooter_id: string;
  date: string;
}

interface AssignmentInfo {
  shooter_id: string;
  wedding_id: string;
  date: string;
  couple_initials: string;
}

function formatDateHeader(dateStr: string): { day: string; dow: string; monthDay: string } {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = String(d.getDate());
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { day, dow, monthDay };
}

export default function AdminCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [weddingDates, setWeddingDates] = useState<WeddingDate[]>([]);
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month + 1, 0);
  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [shootersRes, weddingsRes, blockedRes, assignmentsRes] = await Promise.all([
      supabase
        .from("shooter_profiles")
        .select("id, name, headshot_url, roles")
        .eq("onboarding_completed", true)
        .order("name"),
      supabase
        .from("weddings")
        .select("id, date, couples(names)")
        .gte("date", firstDay)
        .lte("date", lastDay)
        .order("date"),
      supabase
        .from("blocked_dates")
        .select("shooter_id, date")
        .gte("date", firstDay)
        .lte("date", lastDay),
      supabase
        .from("assignments")
        .select("shooter_id, wedding_id, weddings(date, couples(names))")
    ]);

    if (shootersRes.data) setShooters(shootersRes.data as Shooter[]);

    if (weddingsRes.data) {
      const mapped: WeddingDate[] = [];
      for (const w of weddingsRes.data) {
        const couples = w.couples as unknown as { names: string } | null;
        mapped.push({
          date: w.date,
          couple_names: couples?.names || "TBD",
          wedding_id: w.id,
        });
      }
      setWeddingDates(mapped);
    }

    if (blockedRes.data) setBlocked(blockedRes.data);

    if (assignmentsRes.data) {
      const mapped: AssignmentInfo[] = [];
      for (const a of assignmentsRes.data) {
        const wedding = a.weddings as unknown as { date: string; couples: { names: string } | null };
        if (!wedding || wedding.date < firstDay || wedding.date > lastDay) continue;
        const names = wedding.couples?.names || "??";
        const initials = names
          .split(/\s*[&+]\s*/)
          .map((n: string) => n.trim().charAt(0).toUpperCase())
          .join("");
        mapped.push({
          shooter_id: a.shooter_id,
          wedding_id: a.wedding_id,
          date: wedding.date,
          couple_initials: initials,
        });
      }
      setAssignments(mapped);
    }

    setLoading(false);
  }, [firstDay, lastDay]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredShooters = shooters.filter((s) => {
    if (roleFilter && !s.roles.includes(roleFilter)) return false;
    return true;
  });

  // Only show columns for dates that have weddings
  const uniqueWeddingDates = [...new Set(weddingDates.map((w) => w.date))].sort();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function getCellState(shooterId: string, dateStr: string) {
    const isPast = dateStr < todayStr;
    const assignment = assignments.find((a) => a.shooter_id === shooterId && a.date === dateStr);
    const isBlocked = blocked.some((b) => b.shooter_id === shooterId && b.date === dateStr);

    if (assignment) return { type: "assigned" as const, assignment };
    if (isBlocked) return { type: "blocked" as const };
    if (isPast) return { type: "past" as const };
    return { type: "available" as const };
  }

  // Get couple names for a wedding date column header
  function getWeddingsForDate(dateStr: string) {
    return weddingDates.filter((w) => w.date === dateStr);
  }

  return (
    <div className="flex flex-col p-4">
      {/* Header with month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-base font-semibold text-foreground">{monthLabel}</h1>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          {ALL_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-success/20 border border-success/30" />
          <span className="text-[10px] text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-error/20 border border-error/30" />
          <span className="text-[10px] text-muted-foreground">Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-warning/20 border border-warning/30" />
          <span className="text-[10px] text-muted-foreground">Assigned</span>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : uniqueWeddingDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
          <p className="text-sm font-medium text-foreground">No weddings this month</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Navigate to a month with weddings, or create one in Weddings.
          </p>
        </div>
      ) : (
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
                    <th
                      key={dateStr}
                      className="min-w-[80px] border-b border-border px-1 py-1.5 text-center"
                    >
                      <div className="text-[9px] text-muted-foreground">{dow}</div>
                      <div className="text-[11px] font-medium text-foreground">{monthDay}</div>
                      {weddings.map((w) => (
                        <div key={w.wedding_id} className="mt-0.5 truncate text-[8px] font-medium text-warning-text">
                          {w.couple_names}
                        </div>
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
                    <div className="flex items-center gap-2">
                      <div className="relative size-6 shrink-0 overflow-hidden rounded-full bg-muted">
                        {shooter.headshot_url ? (
                          <Image
                            src={shooter.headshot_url}
                            alt={shooter.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[8px] font-bold text-muted-foreground">
                            {shooter.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className="truncate text-xs font-medium text-foreground">
                        {shooter.name}
                      </span>
                    </div>
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
                              : state.type === "blocked"
                                ? "Blocked"
                                : state.type === "available"
                                  ? "Available"
                                  : "Past"
                          }
                        >
                          {state.type === "assigned" && "assignment" in state
                            ? state.assignment.couple_initials
                            : state.type === "blocked"
                              ? "×"
                              : state.type === "available"
                                ? "✓"
                                : "—"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredShooters.length === 0 && (
                <tr>
                  <td
                    colSpan={uniqueWeddingDates.length + 1}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No shooters match the filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        Showing {uniqueWeddingDates.length} wedding date{uniqueWeddingDates.length !== 1 ? "s" : ""} · {filteredShooters.length} shooter{filteredShooters.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
