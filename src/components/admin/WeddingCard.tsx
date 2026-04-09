// src/components/admin/WeddingCard.tsx
"use client";

import { useState } from "react";
import { LinkIcon, ExternalLink } from "lucide-react";
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
  couple_id: string | null;
  assignments: WeddingCardAssignment[];
  // Expandable detail fields
  package: string | null;
  hours_of_coverage: number | null;
  gear_notes: string | null;
  timeline_internal_url: string | null;
  timeline_couple_url: string | null;
}

interface WeddingCardProps {
  wedding: WeddingCardData;
  onAssignClick: (weddingId: string, role: string) => void;
  onShooterClick?: (shooterId: string) => void;
  onCoupleClick?: (coupleId: string) => void;
}

const STATUS_STYLES: Record<StaffingStatus, { border: string; dot: string; label: string }> = {
  unstaffed: { border: "border-error/60", dot: "bg-error", label: "Unstaffed" },
  partial:   { border: "border-warning/60", dot: "bg-warning", label: "Partial" },
  staffed:   { border: "border-info/60",  dot: "bg-info",  label: "Staffed" },
  confirmed: { border: "border-success/60", dot: "bg-success", label: "Confirmed" },
};

export function WeddingCard({ wedding, onAssignClick, onShooterClick, onCoupleClick }: WeddingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = getStaffingStatus(wedding, wedding.assignments);
  const styles = STATUS_STYLES[status];
  const neededRoles = getNeededRoles(wedding);
  const assignedRoles = wedding.assignments.map((a) => a.role);
  const unfilledRoles = getUnfilledRoles(neededRoles, assignedRoles);

  const timelineUrl = wedding.timeline_internal_url ?? wedding.timeline_couple_url;

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer",
        styles.border
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Status dot */}
      <div
        className={cn("absolute right-2.5 top-2.5 size-2 rounded-full", styles.dot)}
        title={styles.label}
      />

      {/* Header — couple name with link icon opens side panel */}
      <div className="pr-6">
        {wedding.couple_id ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCoupleClick?.(wedding.couple_id!);
            }}
            className="group inline-flex items-center gap-1 text-xs font-semibold text-foreground leading-tight hover:text-primary"
          >
            <LinkIcon className="size-3 text-muted-foreground group-hover:text-primary" />
            {wedding.couple_names}
          </button>
        ) : (
          <span className="text-xs font-semibold text-foreground leading-tight">
            {wedding.couple_names}
          </span>
        )}
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
            <button
              key={a.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShooterClick?.(a.shooter_id);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <RoleIcon role={a.role} size="xs" />
              <span className="text-[9px] font-medium text-foreground">
                {a.shooter_name.split(" ")[0]}
              </span>
            </button>
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
              onClick={(e) => {
                e.stopPropagation();
                onAssignClick(wedding.id, role);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <span>+</span>
              <RoleIcon role={role} size="xs" />
              <span>{ROLE_SHORT_LABELS[role as keyof typeof ROLE_SHORT_LABELS] ?? role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Expandable details — click card body to toggle */}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          {wedding.package && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground">Package</span>
              <span className="text-[10px] text-foreground">{wedding.package}</span>
            </div>
          )}
          {wedding.services && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground">Services</span>
              <span className="text-[10px] text-foreground">{wedding.services}</span>
            </div>
          )}
          {wedding.hours_of_coverage != null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground">Hours</span>
              <span className="text-[10px] text-foreground">{wedding.hours_of_coverage}h</span>
            </div>
          )}
          {wedding.add_ons && wedding.add_ons.length > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground">Add-ons</span>
              <span className="text-[10px] text-foreground">{wedding.add_ons.join(", ")}</span>
            </div>
          )}
          {wedding.gear_notes && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground">Gear</span>
              <span className="text-[10px] text-foreground">{wedding.gear_notes}</span>
            </div>
          )}
          {timelineUrl && (
            <a
              href={timelineUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              Timeline
            </a>
          )}
        </div>
      )}
    </div>
  );
}
