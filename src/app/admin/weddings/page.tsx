"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, X, Calendar, MapPin, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShooterStatus {
  brief_read: boolean;
  quiz_passed: boolean;
}

interface Wedding {
  id: string;
  date: string;
  venue_name: string | null;
  venue_address: string | null;
  status: string;
  services: string | null;
  package: string | null;
  num_photographers: number;
  num_videographers: number;
  couples: { names: string } | null;
  assignment_count: number;
  shooter_statuses: ShooterStatus[];
}

export default function AdminWeddingsPage() {
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadWeddings();
  }, []);

  async function loadWeddings() {
    const supabase = createClient();
    const { data } = await supabase
      .from("weddings")
      .select("id, date, venue_name, venue_address, status, services, package, num_photographers, num_videographers, couples(names), assignments(id, brief_read, quiz_passed)")
      .order("date", { ascending: true });

    if (data) {
      const mapped: Wedding[] = data.map((w) => {
        const assignments = Array.isArray(w.assignments) ? w.assignments : [];
        return {
          id: w.id,
          date: w.date,
          venue_name: w.venue_name,
          venue_address: w.venue_address,
          status: w.status,
          services: w.services,
          package: w.package,
          num_photographers: w.num_photographers || 0,
          num_videographers: w.num_videographers || 0,
          couples: w.couples as unknown as { names: string } | null,
          assignment_count: assignments.length,
          shooter_statuses: assignments.map((a: { brief_read: boolean; quiz_passed: boolean }) => ({
            brief_read: a.brief_read,
            quiz_passed: a.quiz_passed,
          })),
        };
      });
      setWeddings(mapped);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Weddings</h1>
          <p className="text-xs text-muted-foreground">
            {weddings.length} wedding{weddings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              setSendingReminders(true);
              await fetch("/api/quiz-reminder", { method: "POST" });
              setSendingReminders(false);
            }}
            disabled={sendingReminders}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Bell className="size-3.5" />
            {sendingReminders ? "Sending..." : "Send Reminders"}
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-1.5 bg-primary text-white hover:bg-primary-hover"
            size="sm"
          >
            <Plus className="size-3.5" />
            Create Wedding
          </Button>
        </div>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <CreateWeddingForm
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            router.push(`/admin/weddings/${id}`);
          }}
        />
      )}

      {/* Weddings table */}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : weddings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
          <p className="text-sm font-medium text-foreground">No weddings yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first wedding to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Couple</th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-muted-foreground md:table-cell">Venue</th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-muted-foreground lg:table-cell">Services</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Staffing</th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-muted-foreground md:table-cell">Quiz</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {weddings.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => router.push(`/admin/weddings/${w.id}`)}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-muted/50 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {new Date(w.date + "T12:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {w.couples?.names || "—"}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-muted-foreground" />
                      <span className="truncate text-sm text-muted-foreground">
                        {w.venue_name || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{w.services || "—"}</span>
                      {w.package && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {w.package}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs">
                      {w.num_photographers > 0 && (
                        <span className="text-primary" title="Photographers">
                          📷{w.num_photographers}
                        </span>
                      )}
                      {w.num_videographers > 0 && (
                        <span className="text-accent" title="Videographers">
                          🎬{w.num_videographers}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {w.assignment_count} assigned
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {w.shooter_statuses.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {w.shooter_statuses.map((s, si) => (
                          <span
                            key={si}
                            className={cn(
                              "size-2.5 rounded-full",
                              s.quiz_passed
                                ? "bg-success"
                                : s.brief_read
                                  ? "bg-warning"
                                  : "bg-muted-foreground/30"
                            )}
                            title={
                              s.quiz_passed
                                ? "Quiz passed"
                                : s.brief_read
                                  ? "Brief read, quiz pending"
                                  : "Brief not read"
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        w.status === "published"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateWeddingForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [coupleNames, setCoupleNames] = useState("");
  const [date, setDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!coupleNames.trim() || !date) {
      setError("Couple names and date are required.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Create couple
    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .insert({ names: coupleNames.trim() })
      .select("id")
      .single();

    if (coupleError) {
      setError(coupleError.message);
      setSaving(false);
      return;
    }

    // Create wedding
    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .insert({
        couple_id: couple.id,
        date,
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
        status: "draft",
      })
      .select("id")
      .single();

    setSaving(false);

    if (weddingError) {
      setError(weddingError.message);
      return;
    }

    onCreated(wedding.id);
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">New Wedding</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Couple names <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={coupleNames}
              onChange={(e) => setCoupleNames(e.target.value)}
              placeholder="Austin & JJ"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Date <span className="text-error">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Venue name
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="The Grand Estate"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Venue address
            </label>
            <input
              type="text"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="123 Main St, City, ST"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            size="sm"
            className="gap-1.5 bg-primary text-white hover:bg-primary-hover"
          >
            {saving ? "Creating..." : "Create Wedding"}
          </Button>
        </div>
      </form>
    </div>
  );
}
