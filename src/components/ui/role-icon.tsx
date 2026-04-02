import { Camera, Video, User, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<string, {
  icon: typeof Camera;
  color: string;
  label: string;
}> = {
  lead_photo: { icon: Camera, color: "text-error", label: "Lead Photo" },
  second_photo: { icon: Camera, color: "text-info", label: "2nd Photo" },
  lead_video: { icon: Video, color: "text-error", label: "Lead Video" },
  second_video: { icon: Video, color: "text-info", label: "2nd Video" },
  photobooth: { icon: User, color: "text-warning", label: "Photobooth" },
  drone: { icon: Plane, color: "text-success", label: "Drone" },
};

export function RoleIcon({
  role,
  size = "sm",
  showLabel = false,
}: {
  role: string;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;

  const Icon = config.icon;
  const sizeClass = size === "xs" ? "size-3" : size === "sm" ? "size-3.5" : "size-4";

  return (
    <span
      className={cn("inline-flex items-center gap-1", config.color)}
      title={config.label}
    >
      <Icon className={sizeClass} />
      {showLabel && <span className="text-[10px] font-medium">{config.label}</span>}
    </span>
  );
}

export function RoleIcons({
  roles,
  size = "sm",
}: {
  roles: string[];
  size?: "xs" | "sm" | "md";
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {roles.map((role) => (
        <RoleIcon key={role} role={role} size={size} />
      ))}
    </span>
  );
}

export { ROLE_CONFIG };
