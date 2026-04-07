// src/components/admin/WeddingCard.tsx
"use client";

import { cn } from "@/lib/utils";
import { RoleIcon } from "@/components/ui/role-icon";
import { ROLE_SHORT_LABELS } from "@/lib/utils/roles";
import {
  getNeededRoles,
  getUnfilledRoles,
  getStaffingStatus,
  type WeddingForScheduling,
  type AssignmentForScheduling,
  type StaffingStatus,
} from "@/lib/utils/scheduling";

export interface WeddingCardAssignment extends AssignmentForScheduling {
  id: string;
  shooter_id: string;
  shooter_name: string;
}

export interface WeddingCardData extends WeddingForScheduling {
  id: string;
  date: string;
  venue_name: string | null;
  couple_names: string;
  assignments: WeddingCardAssignment[];
}

interface WeddingCardProps {
  wedding: WeddingCardData;
  onAssignClick: (weddingId: string, role: string) => void;
}

const STATUS_STYLES: Record<StaffingStatus, { border: string; dot: string; label: string }> = {
  unstaffed: { border: "border-error/60", dot: "bg-error", label: "Unstaffed" },
  partial:   { border: "border-warning/60", dot: "bg-warning", label: "Partial" },
  staffed:   { border: "border-info/60",  dot: "bg-info",  label: "Staffed" },
  confirmed: { border: "border-success/60", dot: "bg-success", label: "Confirmed" },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WeddingCard({ wedding, onAssignClick }: WeddingCardProps) {
  const status = getStaffingStatus(wedding, wedding.assignments);
  const styles = STATUS_STYLES[status];
  const neededRoles = getNeededRoles(wedding);
  const assignedRoles = wedding.assignments.map((a) => a.role);
  const unfilledRoles = getUnfilledRoles(neededRoles, assignedRoles);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        styles.border
      )}
    >
      {/* Status dot */}
      <div
        className={cn("absolute right-2.5 top-2.5 size-2 rounded-full", styles.dot)}
        title={styles.label}
      />

      {/* Header */}
      <div className="pr-4">
        <p className="text-xs font-semibold text-foreground leading-tight">
          {wedding.couple_names}
        </p>
        {wedding.venue_name && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {wedding.venue_name}
          </p>
        )}
      </div>

      {/* Assigned shooters as pills */}
      {wedding.assignments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {wedding.assignments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5"
            >
              <RoleIcon role={a.role} size="xs" />
              <span className="text-[9px] font-medium text-foreground">
                {a.shooter_name.split(" ")[0]}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Unfilled role buttons */}
      {unfilledRoles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {unfilledRoles.map((role, i) => (
            <button
              key={`${role}-${i}`}
              type="button"
              onClick={() => onAssignClick(wedding.id, role)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <span>+</span>
              <RoleIcon role={role} size="xs" />
              <span>{ROLE_SHORT_LABELS[role as keyof typeof ROLE_SHORT_LABELS] ?? role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
