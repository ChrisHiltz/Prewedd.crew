"use client";

import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function AutosaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "size-2 rounded-full transition-colors duration-300",
          status === "idle" && "bg-muted-foreground/30",
          status === "saving" && "animate-pulse bg-primary",
          status === "saved" && "bg-success",
          status === "error" && "bg-error"
        )}
      />
      <span
        className={cn(
          "text-[10px] font-medium transition-colors duration-300",
          status === "idle" && "text-muted-foreground/50",
          status === "saving" && "text-primary",
          status === "saved" && "text-success",
          status === "error" && "text-error"
        )}
      >
        {status === "idle" && "Waiting for changes"}
        {status === "saving" && "Saving..."}
        {status === "saved" && "Saved"}
        {status === "error" && "Save failed"}
      </span>
    </div>
  );
}
