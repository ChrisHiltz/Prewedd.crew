// src/components/admin/KanbanView.tsx
"use client";

import { useMemo } from "react";
import { WeddingCard, type WeddingCardData } from "@/components/admin/WeddingCard";
import { getNeededRoles, getUnfilledRoles } from "@/lib/utils/scheduling";

interface KanbanViewProps {
  weddings: WeddingCardData[];
  onAssignClick: (weddingId: string, role: string) => void;
  onShooterClick?: (shooterId: string) => void;
  onCoupleClick?: (coupleId: string) => void;
}

function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const currentYear = now.getFullYear();
  const wYear = d.getFullYear();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return wYear !== currentYear ? `${month} ${wYear}` : month;
}

function formatColumnHeader(dateStr: string): { dow: string; monthDay: string } {
  const d = new Date(dateStr + "T12:00:00");
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short" }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export function KanbanView({ weddings, onAssignClick, onShooterClick, onCoupleClick }: KanbanViewProps) {
  // Group weddings by month, then by date within each month
  const months = useMemo(() => {
    const monthMap = new Map<string, Map<string, WeddingCardData[]>>();

    for (const w of weddings) {
      const mk = getMonthKey(w.date);
      if (!monthMap.has(mk)) monthMap.set(mk, new Map());
      const dateMap = monthMap.get(mk)!;
      if (!dateMap.has(w.date)) dateMap.set(w.date, []);
      dateMap.get(w.date)!.push(w);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, dateMap]) => ({
        monthKey,
        label: formatMonthLabel(Array.from(dateMap.keys())[0]),
        dates: Array.from(dateMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, ws]) => ({
            date,
            header: formatColumnHeader(date),
            weddings: ws,
          })),
      }));
  }, [weddings]);

  if (weddings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border py-24">
        <p className="text-sm font-medium text-foreground">No upcoming weddings</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create weddings in the Weddings section to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 overflow-x-hidden">
      {months.map(({ monthKey, label, dates }) => (
        <div key={monthKey}>
          {/* Sticky month header */}
          <div className="sticky top-0 z-10 mb-3 border-b border-border bg-background/95 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">{label}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {dates.length} date{dates.length !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {dates.reduce((sum, d) => sum + d.weddings.length, 0)} wedding{dates.reduce((sum, d) => sum + d.weddings.length, 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Horizontal scroll of date columns */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3" style={{ minWidth: "max-content" }}>
              {dates.map(({ date, header, weddings: dateWeddings }) => {
                const totalGaps = dateWeddings.reduce((sum, w) => {
                  const needed = getNeededRoles(w);
                  const assigned = w.assignments.map((a) => a.role);
                  return sum + getUnfilledRoles(needed, assigned).length;
                }, 0);

                return (
                  <div key={date} className="w-52 shrink-0">
                    {/* Column header — date with gap badge to the right */}
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                      <div>
                        <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          {header.dow}
                        </div>
                        <div className="text-[11px] font-semibold text-foreground">
                          {header.monthDay}
                        </div>
                      </div>
                      {totalGaps > 0 ? (
                        <span className="rounded-full bg-warning/20 px-1.5 py-0.5 text-[8px] font-medium text-warning-text">
                          {totalGaps}
                        </span>
                      ) : (
                        <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[8px] font-medium text-success">
                          ✓
                        </span>
                      )}
                    </div>

                    {/* Wedding cards in this column */}
                    <div className="space-y-2">
                      {dateWeddings.map((w) => (
                        <WeddingCard
                          key={w.id}
                          wedding={w}
                          onAssignClick={onAssignClick}
                          onShooterClick={onShooterClick}
                          onCoupleClick={onCoupleClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
