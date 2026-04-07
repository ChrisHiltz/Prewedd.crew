// src/lib/utils/roles.ts

export type CrewRole =
  | "lead_photo"
  | "second_photo"
  | "lead_video"
  | "second_video"
  | "photobooth"
  | "drone"
  | "assistant";

export const ALL_CREW_ROLES: CrewRole[] = [
  "lead_photo",
  "second_photo",
  "lead_video",
  "second_video",
  "photobooth",
  "drone",
  "assistant",
];

export const ROLE_LABELS: Record<string, string> = {
  lead_photo: "Lead Photographer",
  second_photo: "Second Photographer",
  lead_video: "Lead Videographer",
  second_video: "Second Videographer",
  photobooth: "Photobooth Operator",
  drone: "Drone Operator",
  assistant: "Assistant",
};

export const ROLE_SHORT_LABELS: Record<string, string> = {
  lead_photo: "Lead Photo",
  second_photo: "2nd Photo",
  lead_video: "Lead Video",
  second_video: "2nd Video",
  photobooth: "Photobooth",
  drone: "Drone",
  assistant: "Assistant",
};

/** Roles available for shooter onboarding + roster selection */
export const SELECTABLE_ROLES: { value: CrewRole; label: string }[] = [
  { value: "lead_photo", label: "Lead Photographer" },
  { value: "second_photo", label: "Second Photographer" },
  { value: "lead_video", label: "Lead Videographer" },
  { value: "second_video", label: "Second Videographer" },
  { value: "photobooth", label: "Photobooth Operator" },
  { value: "drone", label: "Drone Operator" },
  { value: "assistant", label: "Assistant" },
];

/** For filter dropdowns — includes "All Roles" option */
export const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Roles" },
  ...SELECTABLE_ROLES,
];

export function isCrewRole(value: string): value is CrewRole {
  return ALL_CREW_ROLES.includes(value as CrewRole);
}
