"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockedDate {
  id: string;
  date: string;
}

interface Assignment {
  wedding_id: string;
  wedding_date: string;
  couple_initials: string;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load profile ID
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("shooter_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profile) setProfileId(profile.id);
    }
    loadProfile();
  }, []);

  // Load blocked dates + assignments for visible month
  const loadMonthData = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    const supabase = createClient();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0);
    const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

    const [blockedRes, assignmentsRes] = await Promise.all([
      supabase
        .from("blocked_dates")
        .select("id, date")
        .eq("shooter_id", profileId)
        .gte("date", firstDay)
        .lte("date", lastDayStr),
      supabase
        .from("assignments")
        .select("wedding_id, weddings(date, couples(names))")
        .eq("shooter_id", profileId),
    ]);

    if (blockedRes.data) setBlocked(blockedRes.data);

    if (assignmentsRes.data) {
      const mapped: Assignment[] = [];
      for (const a of assignmentsRes.data) {
        const wedding = a.weddings as unknown as { date: string; couples: { names: string } | null };
        if (!wedding) continue;
        const weddingDate = wedding.date;
        if (weddingDate >= firstDay && weddingDate <= lastDayStr) {
          const names = wedding.couples?.names || "??";
          const initials = names
            .split(/\s*[&+]\s*/)
            .map((n: string) => n.trim().charAt(0).toUpperCase())
            .join("");
          mapped.push({
            wedding_id: a.wedding_id,
            wedding_date: weddingDate,
            couple_initials: initials,
          });
        }
      }
      setAssignments(mapped);
    }

    setLoading(false);
  }, [profileId, currentMonth]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  async function toggleBlock(dateStr: string) {
    if (!profileId) return;

    const existing = blocked.find((b) => b.date === dateStr);
    const supabase = createClient();

    if (existing) {
      // Optimistic unblock
      setBlocked((prev) => prev.filter((b) => b.id !== existing.id));
      await supabase.from("blocked_dates").delete().eq("id", existing.id);
    } else {
      // Optimistic block
      const tempId = crypto.randomUUID();
      setBlocked((prev) => [...prev, { id: tempId, date: dateStr }]);

      const { data } = await supabase
        .from("blocked_dates")
        .insert({ shooter_id: profileId, date: dateStr })
        .select("id")
        .single();

      if (data) {
        setBlocked((prev) =>
          prev.map((b) => (b.id === tempId ? { ...b, id: data.id } : b))
        );
      }
    }
  }

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="text-base font-semibold text-foreground">{monthLabel}</h2>
        <button
          type="button"
          onClick={nextMonth}
          className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className="min-h-[44px]" />;
          }

          const isToday = cell.dateStr === todayStr;
          const isPast = cell.dateStr < todayStr;
          const isBlocked = blocked.some((b) => b.date === cell.dateStr);
          const assignment = assignments.find((a) => a.wedding_date === cell.dateStr);

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={isPast && !assignment}
              onClick={() => {
                if (assignment) {
                  router.push(`/weddings/${assignment.wedding_id}`);
                } else if (!isPast) {
                  toggleBlock(cell.dateStr);
                }
              }}
              className={cn(
                "relative flex min-h-[44px] flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors",
                isPast && "text-muted-foreground/40",
                !isPast && !isBlocked && !assignment && "text-foreground hover:bg-muted",
                isBlocked && "bg-error/10 text-error",
                assignment && "bg-warning-fill text-warning-text cursor-pointer",
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
            >
              {cell.day}
              {isBlocked && !assignment && (
                <span className="absolute bottom-1 size-1.5 rounded-full bg-error" />
              )}
              {assignment && (
                <span className="text-[8px] font-bold leading-none">
                  {assignment.couple_initials}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-error" />
          <span className="text-[10px] text-muted-foreground">Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" />
          <span className="text-[10px] text-muted-foreground">Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full ring-2 ring-primary" />
          <span className="text-[10px] text-muted-foreground">Today</span>
        </div>
      </div>

      {loading && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Loading...</p>
      )}
    </div>
  );
}
