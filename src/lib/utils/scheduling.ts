// src/lib/utils/scheduling.ts
// Single source of truth for all scheduling logic.
// KanbanView, WeddingCard, and AssignSlideOut import from here — never redefine locally.

export interface WeddingForScheduling {
  services: string | null;
  num_photographers: number;
  num_videographers: number;
  num_assistants: number;
  assistant_roles: string[] | null;
  add_ons: string[] | null;
}

export interface AssignmentForScheduling {
  role: string;
  status: string;
  brief_read: boolean;
  quiz_passed: boolean;
}

export type StaffingStatus = "unstaffed" | "partial" | "staffed" | "confirmed";

/**
 * Returns the list of roles needed for a wedding.
 */
export function getNeededRoles(wedding: WeddingForScheduling): string[] {
  const roles: string[] = [];

  const tokens = (wedding.services ?? "")
    .toLowerCase()
    .split(/[+,]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const hasPhoto = tokens.includes("photo");
  const hasVideo = tokens.includes("video");

  if (hasPhoto) {
    if (wedding.num_photographers >= 1) roles.push("lead_photo");
    if (wedding.num_photographers >= 2) roles.push("second_photo");
  }

  if (hasVideo) {
    if (wedding.num_videographers >= 1) roles.push("lead_video");
    if (wedding.num_videographers >= 2) roles.push("second_video");
  }

  if (wedding.num_assistants > 0) {
    const ar = wedding.assistant_roles;
    if (ar && ar.length > 0) {
      const count = Math.min(wedding.num_assistants, ar.length);
      for (let i = 0; i < count; i++) {
        roles.push(ar[i]);
      }
      for (let i = ar.length; i < wedding.num_assistants; i++) {
        roles.push("assistant");
      }
    } else {
      for (let i = 0; i < wedding.num_assistants; i++) {
        roles.push("assistant");
      }
    }
  }

  if (wedding.add_ons?.some((a) => a.toLowerCase().includes("drone"))) {
    roles.push("drone");
  }

  return roles;
}

export function getUnfilledRoles(
  neededRoles: string[],
  assignedRoles: string[]
): string[] {
  const remaining = [...assignedRoles];
  const unfilled: string[] = [];
  for (const role of neededRoles) {
    const idx = remaining.indexOf(role);
    if (idx >= 0) {
      remaining.splice(idx, 1);
    } else {
      unfilled.push(role);
    }
  }
  return unfilled;
}

export function getStaffingStatus(
  wedding: WeddingForScheduling,
  assignments: AssignmentForScheduling[]
): StaffingStatus {
  if (assignments.length === 0) return "unstaffed";

  const neededRoles = getNeededRoles(wedding);
  const assignedRoles = assignments.map((a) => a.role);
  const unfilled = getUnfilledRoles(neededRoles, assignedRoles);

  if (unfilled.length > 0) return "partial";

  const allConfirmed = assignments.every(
    (a) => a.status === "confirmed" && a.brief_read && a.quiz_passed
  );
  return allConfirmed ? "confirmed" : "staffed";
}

export function skillRating(
  skill_scores: Record<string, number> | null | undefined
): number {
  if (!skill_scores) return 0;
  const values = Object.values(skill_scores);
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getWeekendWindow(weddingDateStr: string): [string, string, string] {
  const base = new Date(weddingDateStr + "T12:00:00");
  const prev = new Date(base);
  prev.setDate(base.getDate() - 1);
  const next = new Date(base);
  next.setDate(base.getDate() + 1);

  function toISO(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  return [toISO(prev), toISO(base), toISO(next)];
}
