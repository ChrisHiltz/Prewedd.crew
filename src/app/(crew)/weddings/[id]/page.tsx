"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { RoleIcon } from "@/components/ui/role-icon";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Users,
  Heart,
  Sparkles,
  AlertTriangle,
  Phone,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BriefData {
  names: string;
  pronouns?: string | null;
  description?: string | null;
  energy_profile?: {
    general_energy?: string;
    affection_style?: string;
    camera_comfort?: number;
    stress_style?: string;
  };
  best_day_ever?: string | null;
  excited_about?: string | null;
  nervous_about?: string | null;
}

interface TimelineBlock {
  time: string;
  event: string;
  approach_notes: string;
  key_shots: string;
  is_priority: boolean;
}

interface TeamMember {
  name: string;
  role: string;
  phone: string;
}

interface WeddingBrief {
  id: string;
  date: string;
  venue_name: string | null;
  venue_address: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  gear_notes: string | null;
  meal_plan: string | null;
  wrap_time: string | null;
  file_deadline: string | null;
  team_notes: string | null;
  brief_couple_data: BriefData;
  timeline: TimelineBlock[];
  quiz_questions: unknown[];
  status: string;
  timeline_couple_url: string | null;
  moodboard_url: string | null;
  family_checklist_url: string | null;
  timeline_internal_url: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  lead_photo: "Lead Photographer",
  second_photo: "Second Photographer",
  lead_video: "Lead Videographer",
  second_video: "Second Videographer",
  photobooth: "Photobooth Operator",
  drone: "Drone Operator",
};

export default function ShooterBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [wedding, setWedding] = useState<WeddingBrief | null>(null);
  const [myRole, setMyRole] = useState("");
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [briefRead, setBriefRead] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizTimer, setQuizTimer] = useState(20); // 20 seconds
  const [timerDone, setTimerDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const markedReadRef = useRef(false);

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

      // Load wedding
      const { data: weddingData } = await supabase
        .from("weddings")
        .select("id, date, venue_name, venue_address, coordinator_name, coordinator_phone, gear_notes, meal_plan, wrap_time, file_deadline, team_notes, brief_couple_data, timeline, quiz_questions, status, timeline_couple_url, moodboard_url, family_checklist_url, timeline_internal_url")
        .eq("id", id)
        .single();

      if (weddingData) {
        setWedding({
          ...weddingData,
          brief_couple_data: (weddingData.brief_couple_data || {}) as BriefData,
          timeline: Array.isArray(weddingData.timeline) ? weddingData.timeline as TimelineBlock[] : [],
          quiz_questions: Array.isArray(weddingData.quiz_questions) ? weddingData.quiz_questions : [],
        });
      }

      // Load my assignment
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id, role, brief_read, quiz_passed")
        .eq("wedding_id", id)
        .eq("shooter_id", profile.id)
        .single();

      if (assignment) {
        setMyRole(assignment.role);
        setAssignmentId(assignment.id);
        setBriefRead(assignment.brief_read);
        setQuizPassed(assignment.quiz_passed);

        // Mark as read on first open
        if (!assignment.brief_read && !markedReadRef.current) {
          markedReadRef.current = true;
          await supabase
            .from("assignments")
            .update({ brief_read: true, brief_read_at: new Date().toISOString() })
            .eq("id", assignment.id);
          setBriefRead(true);
        }

        // If already read, skip timer
        if (assignment.brief_read || assignment.quiz_passed) {
          setTimerDone(true);
          setQuizTimer(0);
        }
      }

      // Load team members (other shooters on this wedding)
      const { data: allAssignments } = await supabase
        .from("assignments")
        .select("role, shooter_profiles(name, phone)")
        .eq("wedding_id", id);

      if (allAssignments) {
        const members: TeamMember[] = allAssignments
          .filter((a) => {
            const sp = a.shooter_profiles as unknown as { name: string; phone: string } | null;
            return sp && sp.name;
          })
          .map((a) => {
            const sp = a.shooter_profiles as unknown as { name: string; phone: string };
            return { name: sp.name, role: a.role, phone: sp.phone || "" };
          });
        setTeam(members);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  // Quiz countdown timer
  useEffect(() => {
    if (timerDone || quizTimer <= 0) {
      setTimerDone(true);
      return;
    }

    timerRef.current = setInterval(() => {
      setQuizTimer((prev) => {
        if (prev <= 1) {
          setTimerDone(true);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerDone, quizTimer]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><p className="text-sm text-muted-foreground">Loading brief...</p></div>;
  }

  if (!wedding) {
    return <div className="flex flex-1 items-center justify-center"><p className="text-sm text-muted-foreground">Brief not found</p></div>;
  }

  const couple = wedding.brief_couple_data;
  const formattedDate = new Date(wedding.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const initials = (couple.names || "??")
    .split(/\s*[&+]\s*/)
    .map((n) => n.trim().charAt(0).toUpperCase())
    .join("");

  const timerMinutes = Math.floor(quizTimer / 60);
  const timerSeconds = quizTimer % 60;

  return (
    <div className="flex flex-col pb-24">
      {/* Back nav */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Link href="/weddings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Weddings
        </Link>
      </div>

      {/* Section 1: Meet the Couple */}
      <section className="px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl font-bold text-primary">{initials}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{couple.names || "The Couple"}</h1>
          {couple.pronouns && (
            <p className="mt-1 text-sm text-muted-foreground">{couple.pronouns}</p>
          )}
          {couple.description && (
            <p className="mt-2 text-sm text-foreground">{couple.description}</p>
          )}
          {couple.energy_profile?.general_energy && (
            <span className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
              {couple.energy_profile.general_energy}
            </span>
          )}
          {(wedding.moodboard_url || wedding.family_checklist_url || wedding.timeline_couple_url) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {wedding.moodboard_url && (
                <a href={wedding.moodboard_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning-text hover:bg-warning/20">
                  <ExternalLink className="size-3" />
                  Moodboard
                </a>
              )}
              {wedding.family_checklist_url && (
                <a href={wedding.family_checklist_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success hover:bg-success/20">
                  <ExternalLink className="size-3" />
                  Family Shots
                </a>
              )}
              {wedding.timeline_couple_url && (
                <a href={wedding.timeline_couple_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-info/10 px-3 py-1 text-xs font-medium text-info hover:bg-info/20">
                  <ExternalLink className="size-3" />
                  Timeline
                </a>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {couple.best_day_ever && (
            <CoupleCard icon={Heart} label="Their best day ever" color="text-primary">
              {couple.best_day_ever}
            </CoupleCard>
          )}
          {couple.excited_about && (
            <CoupleCard icon={Sparkles} label="Most excited about" color="text-warning">
              {couple.excited_about}
            </CoupleCard>
          )}
          {couple.nervous_about && (
            <CoupleCard icon={AlertTriangle} label="Nervous about" color="text-error">
              {couple.nervous_about}
            </CoupleCard>
          )}
        </div>
      </section>

      {/* Section 2: Timeline */}
      {wedding.timeline.length > 0 && (
        <section className="border-t border-border px-4 py-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Timeline</h2>
          <div className="space-y-3">
            {wedding.timeline.map((block, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border bg-card p-4",
                  block.is_priority ? "border-l-4 border-l-warning border-warning/30" : "border-border"
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  {block.time && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                      {block.time}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-foreground">{block.event}</span>
                  {block.is_priority && (
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-medium text-warning-text">
                      Priority
                    </span>
                  )}
                </div>
                {block.approach_notes && (
                  <p className="mt-2 text-sm text-foreground">{block.approach_notes}</p>
                )}
                {block.key_shots && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Key shots:</span> {block.key_shots}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Team */}
      {team.length > 0 && (
        <section className="border-t border-border px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Your Team</h2>
            {team.some((m) => m.phone) && (
              <button
                type="button"
                onClick={() => {
                  const phones = team.filter((m) => m.phone).map((m) => m.phone);
                  // iOS uses commas, Android uses semicolons — try comma first (works on both modern)
                  const smsUrl = `sms:${phones.join(",")}`;
                  window.location.href = smsUrl;
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <MessageCircle className="size-3.5" />
                Group Text
              </button>
            )}
          </div>
          <div className="space-y-2">
            {team.map((member, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <RoleIcon role={member.role} size="md" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role] || member.role}</p>
                  </div>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => { window.location.href = `tel:${member.phone}`; }}
                      title="Call"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { window.location.href = `sms:${member.phone}`; }}
                      title="Text"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {wedding.team_notes && (
            <div className="mt-3 rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Team Notes</p>
              <p className="mt-1 text-sm text-foreground">{wedding.team_notes}</p>
            </div>
          )}
        </section>
      )}

      {/* Section 4: Logistics */}
      <section className="border-t border-border px-4 py-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Logistics</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <RoleIcon role={myRole} size="sm" />
            <span className="text-foreground">{ROLE_LABELS[myRole] || myRole}</span>
          </div>
          {wedding.venue_name && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(wedding.venue_address || wedding.venue_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-primary hover:underline"
            >
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{wedding.venue_name}</p>
                {wedding.venue_address && <p className="text-xs text-muted-foreground">{wedding.venue_address}</p>}
              </div>
            </a>
          )}
          {wedding.coordinator_name && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <span>{wedding.coordinator_name}</span>
              {wedding.coordinator_phone && (
                <a href={`tel:${wedding.coordinator_phone}`} className="text-primary hover:underline">
                  {wedding.coordinator_phone}
                </a>
              )}
            </div>
          )}
          {wedding.gear_notes && (
            <div className="flex items-start gap-2 text-sm text-foreground">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Gear</p>
                <p>{wedding.gear_notes}</p>
              </div>
            </div>
          )}
          {wedding.meal_plan && (
            <div className="flex items-start gap-2 text-sm text-foreground">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Meal</p>
                <p>{wedding.meal_plan}</p>
              </div>
            </div>
          )}
          {wedding.wrap_time && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span>Wrap at {wedding.wrap_time}</span>
            </div>
          )}
          {wedding.file_deadline && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span>Files due: {wedding.file_deadline}</span>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Quiz CTA — sticky bottom */}
      {wedding.quiz_questions.length > 0 && !quizPassed && (
        <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-border bg-background px-4 py-3">
          <Button
            onClick={() => router.push(`/weddings/${id}/quiz`)}
            disabled={!timerDone}
            className={cn(
              "w-full gap-2",
              timerDone
                ? "bg-primary text-white hover:bg-primary-hover"
                : "bg-muted text-muted-foreground"
            )}
          >
            {timerDone ? (
              "Take the Quiz"
            ) : (
              <>
                Review the brief ({timerMinutes}:{timerSeconds.toString().padStart(2, "0")})
              </>
            )}
          </Button>
        </div>
      )}

      {quizPassed && (
        <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-border bg-success/10 px-4 py-3 text-center">
          <p className="text-sm font-medium text-success">Quiz passed — you&apos;re ready!</p>
        </div>
      )}
    </div>
  );
}

function CoupleCard({
  icon: Icon,
  label,
  color,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className={cn("size-4", color)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}
