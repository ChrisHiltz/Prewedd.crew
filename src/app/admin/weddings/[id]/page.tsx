"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  FileText,
  UserPlus,
  Clock,
  Camera,
  Video,
  Users,
  ExternalLink,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WeddingDetail {
  id: string;
  date: string;
  venue_name: string | null;
  venue_address: string | null;
  ceremony_location: string | null;
  getting_ready_location: string | null;
  status: string;
  team_notes: string | null;
  services: string | null;
  package: string | null;
  num_photographers: number;
  num_videographers: number;
  num_assistants: number;
  assistant_roles: string | null;
  add_ons: string[] | null;
  dress_code: string | null;
  hours_of_coverage: string | null;
  planner_name: string | null;
  timeline_couple_url: string | null;
  moodboard_url: string | null;
  family_checklist_url: string | null;
  timeline_internal_url: string | null;
  team_confirmation_status: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  gear_notes: string | null;
  meal_plan: string | null;
  wrap_time: string | null;
  file_deadline: string | null;
  couples: {
    id: string;
    names: string;
  } | null;
}

interface Assignment {
  id: string;
  role: string;
  status: string;
  brief_read: boolean;
  quiz_passed: boolean;
  shooter_profiles: {
    id: string;
    name: string;
    headshot_url: string | null;
    roles: string[];
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  lead_photo: "Lead Photographer",
  second_photo: "Second Photographer",
  lead_video: "Lead Videographer",
  second_video: "Second Videographer",
  photobooth: "Photobooth Operator",
  drone: "Drone Operator",
};

export default function WeddingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [wedding, setWedding] = useState<WeddingDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: weddingData } = await supabase
        .from("weddings")
        .select("*, couples(id, names)")
        .eq("id", id)
        .single();

      if (weddingData) {
        setWedding({
          ...weddingData,
          couples: weddingData.couples as unknown as { id: string; names: string } | null,
        });
      }

      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("id, role, status, brief_read, quiz_passed, shooter_profiles(id, name, headshot_url, roles)")
        .eq("wedding_id", id);

      if (assignmentData) {
        setAssignments(
          assignmentData.map((a) => ({
            ...a,
            shooter_profiles: a.shooter_profiles as unknown as Assignment["shooter_profiles"],
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!wedding) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Wedding not found</p>
      </div>
    );
  }

  const formattedDate = new Date(wedding.date + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  const photoNeeded = wedding.num_photographers - assignments.filter(a => a.role.includes("photo")).length;
  const videoNeeded = wedding.num_videographers - assignments.filter(a => a.role.includes("video")).length;

  return (
    <div className="flex flex-col p-4">
      {/* Back link */}
      <Link
        href="/admin/weddings"
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Weddings
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {wedding.couples?.names || "Unnamed Couple"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formattedDate}
            </span>
            {wedding.venue_name && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {wedding.venue_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              wedding.team_confirmation_status === "Scheduled"
                ? "bg-success/15 text-success"
                : "bg-warning-fill text-warning-text"
            )}
          >
            {wedding.team_confirmation_status || "Not Confirmed"}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              wedding.status === "published"
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            )}
          >
            {wedding.status}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        <Link href={`/admin/weddings/${id}/brief`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-3.5" />
            Edit Brief
          </Button>
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          <UserPlus className="size-3.5" />
          Add Shooter
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Service details + Team */}
        <div className="space-y-6">
          {/* Service & Package */}
          <Section title="Service Details">
            <div className="grid grid-cols-2 gap-3">
              <InfoItem icon={Camera} label="Services" value={wedding.services || "—"} />
              <InfoItem icon={FileText} label="Package" value={wedding.package || "—"} />
              <InfoItem icon={Clock} label="Coverage" value={wedding.hours_of_coverage ? `${wedding.hours_of_coverage} hrs` : "—"} />
              <InfoItem icon={User} label="Planner" value={wedding.planner_name || "—"} />
            </div>
          </Section>

          {/* Staffing needs */}
          <Section title="Staffing">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <Camera className="mx-auto mb-1 size-4 text-primary" />
                <p className="text-lg font-semibold text-foreground">{wedding.num_photographers}</p>
                <p className="text-[10px] text-muted-foreground">Photographers</p>
                {photoNeeded > 0 && (
                  <p className="mt-0.5 text-[10px] font-medium text-warning-text">
                    {photoNeeded} needed
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <Video className="mx-auto mb-1 size-4 text-accent" />
                <p className="text-lg font-semibold text-foreground">{wedding.num_videographers}</p>
                <p className="text-[10px] text-muted-foreground">Videographers</p>
                {videoNeeded > 0 && (
                  <p className="mt-0.5 text-[10px] font-medium text-warning-text">
                    {videoNeeded} needed
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <Users className="mx-auto mb-1 size-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">{wedding.num_assistants}</p>
                <p className="text-[10px] text-muted-foreground">Assistants</p>
                {wedding.assistant_roles && (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {wedding.assistant_roles}
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* Add-ons */}
          {wedding.add_ons && wedding.add_ons.length > 0 && (
            <Section title="Add-Ons">
              <div className="flex flex-wrap gap-1.5">
                {wedding.add_ons.map((addon, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {addon}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Team */}
          <Section title={`Team (${assignments.length})`}>
            {assignments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-6 text-center">
                <p className="text-sm text-muted-foreground">No shooters assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                        {a.shooter_profiles?.headshot_url ? (
                          <img
                            src={a.shooter_profiles.headshot_url}
                            alt={a.shooter_profiles.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs font-bold text-muted-foreground">
                            {a.shooter_profiles?.name.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {a.shooter_profiles?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[a.role] || a.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          a.brief_read ? "bg-success" : "bg-muted-foreground/30"
                        )}
                        title={a.brief_read ? "Brief read" : "Brief not read"}
                      />
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          a.quiz_passed ? "bg-success" : "bg-muted-foreground/30"
                        )}
                        title={a.quiz_passed ? "Quiz passed" : "Quiz not passed"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right column: Locations + Links */}
        <div className="space-y-6">
          {/* Locations */}
          <Section title="Locations">
            <div className="space-y-3">
              <LocationItem label="Reception" value={wedding.venue_name} address={wedding.venue_address} />
              <LocationItem label="Ceremony" value={wedding.ceremony_location} />
              <LocationItem label="Getting Ready" value={wedding.getting_ready_location} />
            </div>
          </Section>

          {/* Logistics */}
          <Section title="Logistics">
            <div className="grid grid-cols-2 gap-3">
              {wedding.coordinator_name && (
                <InfoItem icon={User} label="Coordinator" value={wedding.coordinator_name} />
              )}
              {wedding.coordinator_phone && (
                <InfoItem icon={User} label="Coordinator Phone" value={wedding.coordinator_phone} />
              )}
              {wedding.gear_notes && (
                <InfoItem icon={FileText} label="Gear Notes" value={wedding.gear_notes} />
              )}
              {wedding.meal_plan && (
                <InfoItem icon={FileText} label="Meal Plan" value={wedding.meal_plan} />
              )}
              {wedding.wrap_time && (
                <InfoItem icon={Clock} label="Wrap Time" value={wedding.wrap_time} />
              )}
              {wedding.file_deadline && (
                <InfoItem icon={Clock} label="File Deadline" value={wedding.file_deadline} />
              )}
              {wedding.dress_code && (
                <InfoItem icon={FileText} label="Dress Code" value={wedding.dress_code} />
              )}
            </div>
          </Section>

          {/* Google Doc links */}
          {(wedding.timeline_couple_url || wedding.moodboard_url || wedding.family_checklist_url || wedding.timeline_internal_url) && (
            <Section title="Documents">
              <div className="space-y-1.5">
                {wedding.timeline_couple_url && (
                  <DocLink label="Couple Timeline" url={wedding.timeline_couple_url} />
                )}
                {wedding.timeline_internal_url && (
                  <DocLink label="Internal Timeline" url={wedding.timeline_internal_url} />
                )}
                {wedding.moodboard_url && (
                  <DocLink label="Moodboard Notes" url={wedding.moodboard_url} />
                )}
                {wedding.family_checklist_url && (
                  <DocLink label="Family Shot Checklist" url={wedding.family_checklist_url} />
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function LocationItem({
  label,
  value,
  address,
}: {
  label: string;
  value: string | null;
  address?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
        {address && (
          <p className="text-xs text-muted-foreground">{address}</p>
        )}
      </div>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
    >
      <FileText className="size-3.5 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ExternalLink className="size-3 text-muted-foreground" />
    </a>
  );
}
