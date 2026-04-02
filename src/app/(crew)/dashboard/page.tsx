"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Calendar, MapPin, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleIcon } from "@/components/ui/role-icon";
import { cn } from "@/lib/utils";

interface UpcomingWedding {
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

export default function DashboardPage() {
  const [weddings, setWeddings] = useState<UpcomingWedding[]>([]);
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
        // Get couple names for all wedding couple_ids
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
        const mapped: UpcomingWedding[] = assignments
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

  const nextWedding = weddings[0] || null;

  // Action items: briefs unread or quizzes not passed
  const actionItems = weddings.filter(
    (w) => !w.brief_read || !w.quiz_passed
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>

      {/* Next Wedding card */}
      {nextWedding ? (
        <NextWeddingCard wedding={nextWedding} />
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No upcoming weddings
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your profile is live — assignments will appear here.
          </p>
        </div>
      )}

      {/* Action Items */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Action Items
        </h2>
        {actionItems.length === 0 ? (
          <div className="rounded-lg border border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">No open items</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actionItems.slice(0, 3).map((item) => (
              <Link
                key={item.assignment_id}
                href={`/weddings/${item.wedding_id}`}
                className="flex items-center gap-3 rounded-lg border border-error/20 bg-error/5 px-4 py-3 transition-colors hover:bg-error/10"
              >
                <AlertCircle className="size-4 shrink-0 text-error" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {!item.brief_read
                      ? `Review brief for ${item.couple_names}'s wedding`
                      : `Complete quiz for ${item.couple_names}'s wedding`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-medium text-white">
                  {!item.brief_read ? "Brief" : "Quiz"}
                </span>
              </Link>
            ))}
            {actionItems.length > 3 && (
              <Link
                href="/weddings"
                className="block text-center text-xs font-medium text-primary hover:underline"
              >
                See all ({actionItems.length})
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Quick links to upcoming */}
      {weddings.length > 1 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Upcoming ({weddings.length})
            </h2>
            <Link
              href="/weddings"
              className="text-xs font-medium text-primary hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {weddings.slice(1, 4).map((w) => (
              <Link
                key={w.assignment_id}
                href={`/weddings/${w.wedding_id}`}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {w.couple_names}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(w.date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {w.venue_name || "TBD"}
                  </p>
                </div>
                <RoleIcon role={w.role} size="sm" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NextWeddingCard({ wedding }: { wedding: UpcomingWedding }) {
  const weddingDate = new Date(wedding.date + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = weddingDate.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = weddingDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-primary">Next Wedding</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Clock className="size-3" />
            {daysUntil === 0
              ? "Today!"
              : daysUntil === 1
                ? "Tomorrow"
                : `${daysUntil} days`}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-foreground">
          {wedding.couple_names}
        </h3>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-3.5" />
            {formattedDate}
          </div>
          {wedding.venue_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {wedding.venue_name}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RoleIcon role={wedding.role} size="sm" showLabel />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Link href={`/weddings/${wedding.wedding_id}`} className="flex-1">
            <Button
              className="w-full gap-1.5 bg-primary text-white hover:bg-primary-hover"
              size="sm"
            >
              View Brief
            </Button>
          </Link>
        </div>

        {/* Status indicators */}
        <div className="mt-3 flex items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              wedding.brief_read ? "text-success" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                wedding.brief_read ? "bg-success" : "bg-muted-foreground/30"
              )}
            />
            Brief {wedding.brief_read ? "read" : "unread"}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              wedding.quiz_passed ? "text-success" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                wedding.quiz_passed ? "bg-success" : "bg-muted-foreground/30"
              )}
            />
            Quiz {wedding.quiz_passed ? "passed" : "not taken"}
          </span>
        </div>
      </div>
    </div>
  );
}
