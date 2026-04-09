"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { KanbanView } from "@/components/admin/KanbanView";
import { GridView, type GridShooter, type GridWeddingDate, type GridBlockedDate, type GridAssignment } from "@/components/admin/GridView";
import { AssignSlideOut } from "@/components/admin/AssignSlideOut";
import { ShooterPanel } from "@/components/admin/ShooterPanel";
import { CouplePanel } from "@/components/admin/CouplePanel";
import { type WeddingCardData, type WeddingCardAssignment } from "@/components/admin/WeddingCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RoleIcon } from "@/components/ui/role-icon";
import { ROLE_SHORT_LABELS } from "@/lib/utils/roles";

type View = "kanban" | "grid";

interface AssignTarget {
  weddingId: string;
  role: string;
  wedding: WeddingCardData;
}

// ─── Supabase raw types ────────────────────────────────────────────────────────

interface RawKanbanAssignment {
  id: string;
  shooter_id: string;
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

interface RawKanbanWedding {
  id: string;
  date: string;
  venue_name: string | null;
  services: string | null;
  num_photographers: number;
  num_videographers: number;
  num_assistants: number;
  assistant_roles: string[] | null;
  add_ons: string[] | null;
  package: string | null;
  hours_of_coverage: number | null;
  gear_notes: string | null;
  timeline_internal_url: string | null;
  timeline_couple_url: string | null;
  couples: { names: string } | null;
  assignments: RawKanbanAssignment[];
}

interface RawGridAssignment {
  shooter_id: string;
  wedding_id: string;
  weddings: { date: string; couples: { names: string } | null } | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCalendarPage() {
  const [view, setView] = useState<View>("kanban");

  // ── Kanban state ────────────────────────────────────────────────────────────
  const [kanbanWeddings, setKanbanWeddings] = useState<WeddingCardData[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(true);

  // ── Grid state ──────────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [gridShooters, setGridShooters] = useState<GridShooter[]>([]);
  const [gridWeddingDates, setGridWeddingDates] = useState<GridWeddingDate[]>([]);
  const [gridBlocked, setGridBlocked] = useState<GridBlockedDate[]>([]);
  const [gridAssignments, setGridAssignments] = useState<GridAssignment[]>([]);
  const [gridRoleFilter, setGridRoleFilter] = useState("");
  const [gridLoading, setGridLoading] = useState(false);

  // ── Assign slide-out state ──────────────────────────────────────────────────
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [infoWedding, setInfoWedding] = useState<WeddingCardData | null>(null);

  // ── Shooter panel state ─────────────────────────────────────────────────────
  const [activeShooterId, setActiveShooterId] = useState<string | null>(null);

  // ── Couple panel state ──────────────────────────────────────────────────────
  const [activeCoupleId, setActiveCoupleId] = useState<string | null>(null);

  function openShooterPanel(id: string) {
    setActiveShooterId(id);
    setActiveCoupleId(null);
  }

  function openCouplePanel(id: string) {
    setActiveCoupleId(id);
    setActiveShooterId(null);
  }

  // ── Month helpers ──────────────────────────────────────────────────────────
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month + 1, 0);
  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── Load kanban data (all future weddings) ─────────────────────────────────

  const loadKanbanData = useCallback(async () => {
    setKanbanLoading(true);
    const supabase = createClient();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const { data } = await supabase
      .from("weddings")
      .select(`
        id,
        date,
        venue_name,
        services,
        num_photographers,
        num_videographers,
        num_assistants,
        assistant_roles,
        add_ons,
        package,
        hours_of_coverage,
        gear_notes,
        timeline_internal_url,
        timeline_couple_url,
        couples(names),
        assignments(id, shooter_id, role, status, brief_read, quiz_passed, shooter_profiles(id, name, headshot_url))
      `)
      .gte("date", todayStr)
      .order("date");

    if (data) {
      const mapped: WeddingCardData[] = (data as unknown as RawKanbanWedding[]).map((w) => {
        const mappedAssignments: WeddingCardAssignment[] = (w.assignments ?? []).map((a) => ({
          id: a.id,
          shooter_id: a.shooter_id,
          shooter_name: a.shooter_profiles?.name ?? "Unknown",
          role: a.role,
          status: a.status,
          brief_read: a.brief_read ?? false,
          quiz_passed: a.quiz_passed ?? false,
        }));

        return {
          id: w.id,
          date: w.date,
          venue_name: w.venue_name,
          couple_names: w.couples?.names ?? "TBD",
          services: w.services,
          num_photographers: w.num_photographers ?? 0,
          num_videographers: w.num_videographers ?? 0,
          num_assistants: w.num_assistants ?? 0,
          assistant_roles: w.assistant_roles,
          add_ons: w.add_ons,
          package: w.package ?? null,
          hours_of_coverage: w.hours_of_coverage ?? null,
          gear_notes: w.gear_notes ?? null,
          timeline_internal_url: w.timeline_internal_url ?? null,
          timeline_couple_url: w.timeline_couple_url ?? null,
          assignments: mappedAssignments,
        };
      });
      setKanbanWeddings(mapped);
    }

    setKanbanLoading(false);
  }, []);

  useEffect(() => {
    loadKanbanData();
  }, [loadKanbanData]);

  // ── Load grid data (current month) ────────────────────────────────────────

  const loadGridData = useCallback(async () => {
    setGridLoading(true);
    const supabase = createClient();

    const [shootersRes, weddingsRes, blockedRes, assignmentsRes] = await Promise.all([
      supabase
        .from("shooter_profiles")
        .select("id, name, headshot_url, roles, skill_scores, rates, is_employee")
        .order("name"),
      supabase
        .from("weddings")
        .select("id, date, couple_id, couples(names)")
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
        .select("shooter_id, wedding_id, weddings(date, couples(names))"),
    ]);

    if (shootersRes.data) setGridShooters(shootersRes.data as GridShooter[]);

    if (weddingsRes.data) {
      const mapped: GridWeddingDate[] = [];
      for (const w of weddingsRes.data) {
        const couples = w.couples as unknown as { names: string } | null;
        const wRaw = w as unknown as { id: string; date: string; couple_id: string | null; couples: { names: string } | null };
        mapped.push({
          date: wRaw.date,
          couple_names: couples?.names ?? "TBD",
          wedding_id: wRaw.id,
          couple_id: wRaw.couple_id ?? null,
        });
      }
      setGridWeddingDates(mapped);
    }

    if (blockedRes.data) setGridBlocked(blockedRes.data);

    if (assignmentsRes.data) {
      const mapped: GridAssignment[] = [];
      for (const a of (assignmentsRes.data as unknown as RawGridAssignment[])) {
        const wedding = a.weddings;
        if (!wedding || wedding.date < firstDay || wedding.date > lastDay) continue;
        const names = wedding.couples?.names ?? "??";
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
      setGridAssignments(mapped);
    }

    setGridLoading(false);
  }, [firstDay, lastDay]);

  useEffect(() => {
    if (view === "grid") {
      loadGridData();
    }
  }, [view, loadGridData]);

  // ── Assign click handler ───────────────────────────────────────────────────

  function handleAssignClick(weddingId: string, role: string) {
    const wedding = kanbanWeddings.find((w) => w.id === weddingId);
    if (!wedding) return;
    setAssignTarget({ weddingId, role, wedding });
  }

  function handleAssigned() {
    // Refresh kanban data after a successful assignment
    loadKanbanData();
    if (view === "grid") loadGridData();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col p-4">
      {/* Header — sticky so it stays visible while scrolling through months */}
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-background pb-2 pt-0">
        <div className="flex items-center gap-3">

          {/* View toggle pill */}
          <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={
                view === "kanban"
                  ? "rounded-md bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
                  : "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={
                view === "grid"
                  ? "rounded-md bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
                  : "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              Grid
            </button>
          </div>

          {/* Month nav (grid only) */}
          {view === "grid" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {/* Kanban title */}
          {view === "kanban" && (
            <h1 className="text-sm font-semibold text-foreground">Upcoming Weddings</h1>
          )}
        </div>

        {/* Staffing status legend (kanban view only) */}
        {view === "kanban" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-error" />
              <span className="text-xs text-muted-foreground">Unstaffed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-warning" />
              <span className="text-xs text-muted-foreground">Partial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-info" />
              <span className="text-xs text-muted-foreground">Staffed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">Confirmed</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {view === "kanban" ? (
        kanbanLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <KanbanView weddings={kanbanWeddings} onAssignClick={handleAssignClick} onCardClick={setInfoWedding} />
        )
      ) : gridLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <GridView
          shooters={gridShooters}
          weddingDates={gridWeddingDates}
          blocked={gridBlocked}
          assignments={gridAssignments}
          roleFilter={gridRoleFilter}
          onRoleFilterChange={setGridRoleFilter}
          onShooterClick={openShooterPanel}
          onCoupleClick={openCouplePanel}
        />
      )}

      {/* Assign slide-out */}
      {assignTarget && (
        <AssignSlideOut
          open={assignTarget !== null}
          onOpenChange={(open) => {
            if (!open) setAssignTarget(null);
          }}
          weddingId={assignTarget.weddingId}
          weddingDate={assignTarget.wedding.date}
          coupleNames={assignTarget.wedding.couple_names}
          role={assignTarget.role}
          onAssigned={handleAssigned}
        />
      )}

      {/* Shooter info panel */}
      <ShooterPanel shooterId={activeShooterId} onClose={() => setActiveShooterId(null)} />

      {/* Couple info panel */}
      <CouplePanel coupleId={activeCoupleId} onClose={() => setActiveCoupleId(null)} />

      {/* Wedding info side panel */}
      <Sheet open={infoWedding !== null} onOpenChange={(open) => { if (!open) setInfoWedding(null); }}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-md">
          {infoWedding && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-base">{infoWedding.couple_names}</SheetTitle>
                {infoWedding.venue_name && (
                  <p className="text-sm text-muted-foreground">{infoWedding.venue_name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {new Date(infoWedding.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </SheetHeader>

              <div className="space-y-4">
                {/* Services & Package */}
                <div className="space-y-2">
                  {infoWedding.services && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Services</span>
                      <span className="font-medium">{infoWedding.services}</span>
                    </div>
                  )}
                  {infoWedding.package && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Package</span>
                      <span className="font-medium">{infoWedding.package}</span>
                    </div>
                  )}
                  {infoWedding.hours_of_coverage != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hours</span>
                      <span className="font-medium">{infoWedding.hours_of_coverage}h</span>
                    </div>
                  )}
                  {infoWedding.add_ons && infoWedding.add_ons.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Add-ons</span>
                      <span className="font-medium">{infoWedding.add_ons.join(", ")}</span>
                    </div>
                  )}
                  {infoWedding.gear_notes && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gear</span>
                      <span className="font-medium">{infoWedding.gear_notes}</span>
                    </div>
                  )}
                </div>

                {/* Team */}
                {infoWedding.assignments.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team</h3>
                    <div className="space-y-1.5">
                      {infoWedding.assignments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                          <RoleIcon role={a.role} size="sm" />
                          <span className="text-sm font-medium">{a.shooter_name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{ROLE_SHORT_LABELS[a.role as keyof typeof ROLE_SHORT_LABELS] ?? a.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline link */}
                {(infoWedding.timeline_internal_url || infoWedding.timeline_couple_url) && (
                  <a
                    href={infoWedding.timeline_internal_url ?? infoWedding.timeline_couple_url ?? ""}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    View Timeline
                  </a>
                )}

                {/* Link to full record */}
                <Link
                  href={`/admin/weddings/${infoWedding.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Open Full Record
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
