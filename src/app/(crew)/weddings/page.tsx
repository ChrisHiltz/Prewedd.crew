"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Calendar, MapPin } from "lucide-react";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/utils";

interface WeddingAssignment {
  assignment_id: string;
  wedding_id: string;
  role: string;
  brief_read: boolean;
  quiz_passed: boolean;
  date: string;
  venue_name: string | null;
  couple_names: string;
  status: string;
}

export default function WeddingsPage() {
  const [weddings, setWeddings] = useState<WeddingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("shooter_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, role, brief_read, quiz_passed, wedding_id, weddings(date, venue_name, status, couple_id)")
        .eq("shooter_id", profile.id);

      if (assignments) {
        const coupleIds = [
          ...new Set(
            assignments
              .map((a) => {
                const w = a.weddings as unknown as { couple_id: string } | null;
                return w?.couple_id;
              })
              .filter(Boolean)
          ),
        ];

        let coupleMap: Record<string, string> = {};
        if (coupleIds.length > 0) {
          const { data: couples } = await supabase
            .from("couples")
            .select("id, names")
            .in("id", coupleIds);
          if (couples) {
            coupleMap = Object.fromEntries(couples.map((c) => [c.id, c.names]));
          }
        }

        const today = new Date().toISOString().split("T")[0];
        const mapped: WeddingAssignment[] = assignments
          .map((a) => {
            const wedding = a.weddings as unknown as {
              date: string;
              venue_name: string | null;
              status: string;
              couple_id: string | null;
            };
            return {
              assignment_id: a.id,
              wedding_id: a.wedding_id,
              role: a.role,
              brief_read: a.brief_read,
              quiz_passed: a.quiz_passed,
              date: wedding?.date || "",
              venue_name: wedding?.venue_name || null,
              couple_names: wedding?.couple_id ? coupleMap[wedding.couple_id] || "TBD" : "TBD",
              status: wedding?.status || "draft",
            };
          })
          .filter((w) => w.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));

        setWeddings(mapped);
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-foreground">
        My Weddings ({weddings.length})
      </h1>

      {weddings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No upcoming assignments
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;ll see your wedding assignments here once assigned.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {weddings.map((w) => {
            const weddingDate = new Date(w.date + "T12:00:00");
            const formattedDate = weddingDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            // Brief status
            let briefStatus: "unread" | "read" | "quiz_passed" = "unread";
            if (w.quiz_passed) briefStatus = "quiz_passed";
            else if (w.brief_read) briefStatus = "read";

            return (
              <Link
                key={w.assignment_id}
                href={`/weddings/${w.wedding_id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
              >
                {/* Date badge */}
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10">
                  <span className="text-[10px] font-medium text-primary">
                    {weddingDate.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-lg font-bold leading-none text-primary">
                    {weddingDate.getDate()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {w.couple_names}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formattedDate}
                    </span>
                  </div>
                  {w.venue_name && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {w.venue_name}
                    </div>
                  )}
                </div>

                {/* Role + status */}
                <div className="flex flex-col items-end gap-1.5">
                  <RoleIcon role={w.role} size="md" />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-medium",
                      briefStatus === "quiz_passed" && "bg-success/15 text-success",
                      briefStatus === "read" && "bg-warning-fill text-warning-text",
                      briefStatus === "unread" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {briefStatus === "quiz_passed"
                      ? "Ready"
                      : briefStatus === "read"
                        ? "Quiz pending"
                        : "Unread"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
