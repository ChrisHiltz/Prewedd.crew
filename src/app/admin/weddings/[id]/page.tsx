"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import Image from "next/image";
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
  X,
  Trash2,
} from "lucide-react";
import { RoleIcon, RoleIcons } from "@/components/ui/role-icon";
import { EditableCell } from "@/components/ui/editable-cell";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { AutosaveIndicator, type SaveStatus } from "@/components/ui/autosave-indicator";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/utils/roles";

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
  assistant_roles: string[] | null;
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
  couple_id: string | null;
}

interface CoupleInfo {
  id: string;
  names: string;
  pronouns: string | null;
  description: string | null;
  energy_profile: Record<string, unknown>;
  best_day_ever: string | null;
  excited_about: string | null;
  nervous_about: string | null;
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

const ENERGY_OPTIONS = [
  { value: "introverted", label: "Introverted" },
  { value: "calm", label: "Calm" },
  { value: "balanced", label: "Balanced" },
  { value: "outgoing", label: "Outgoing" },
  { value: "high-energy", label: "High-energy" },
];

const AFFECTION_OPTIONS = [
  { value: "reserved", label: "Reserved" },
  { value: "subtle", label: "Subtle" },
  { value: "warm", label: "Warm" },
  { value: "playful", label: "Playful" },
  { value: "very affectionate", label: "Very affectionate" },
];

const STRESS_OPTIONS = [
  { value: "go with the flow", label: "Go with the flow" },
  { value: "quiet adjustment", label: "Quiet adjustment" },
  { value: "need reassurance", label: "Need reassurance" },
  { value: "vocal about it", label: "Vocal about it" },
];

export default function WeddingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [wedding, setWedding] = useState<WeddingDetail | null>(null);
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddShooter, setShowAddShooter] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  async function loadAssignments() {
    const supabase = createClient();
    const { data } = await supabase
      .from("assignments")
      .select("id, role, status, brief_read, quiz_passed, shooter_profiles(id, name, headshot_url, roles)")
      .eq("wedding_id", id);

    if (data) {
      setAssignments(
        data.map((a) => ({
          ...a,
          shooter_profiles: a.shooter_profiles as unknown as Assignment["shooter_profiles"],
        }))
      );
    }
  }

  async function removeAssignment(assignmentId: string) {
    const supabase = createClient();
    await supabase.from("assignments").delete().eq("id", assignmentId);
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: weddingData } = await supabase
        .from("weddings")
        .select("*")
        .eq("id", id)
        .single();

      if (weddingData) {
        setWedding(weddingData as WeddingDetail);

        if (weddingData.couple_id) {
          const { data: coupleData } = await supabase
            .from("couples")
            .select("*")
            .eq("id", weddingData.couple_id)
            .single();
          if (coupleData) setCouple(coupleData as CoupleInfo);
        }
      }

      await loadAssignments();
      setLoading(false);
      setTimeout(() => { initialLoadRef.current = false; }, 500);
    }
    load();
  }, [id]);

  // Autosave wedding fields
  const saveWedding = useCallback(async () => {
    if (!wedding || initialLoadRef.current) return;
    setSaveStatus("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("weddings")
      .update({
        venue_name: wedding.venue_name,
        venue_address: wedding.venue_address,
        ceremony_location: wedding.ceremony_location,
        getting_ready_location: wedding.getting_ready_location,
        coordinator_name: wedding.coordinator_name,
        coordinator_phone: wedding.coordinator_phone,
        gear_notes: wedding.gear_notes,
        meal_plan: wedding.meal_plan,
        wrap_time: wedding.wrap_time,
        file_deadline: wedding.file_deadline,
        dress_code: wedding.dress_code,
        hours_of_coverage: wedding.hours_of_coverage,
        planner_name: wedding.planner_name,
        services: wedding.services,
        package: wedding.package,
        team_notes: wedding.team_notes,
      })
      .eq("id", id);

    if (error) { setSaveStatus("error"); return; }
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [wedding, id]);

  // Autosave couple fields
  const saveCouple = useCallback(async () => {
    if (!couple || initialLoadRef.current) return;
    setSaveStatus("saving");
    const supabase = createClient();

    const coupleData = {
      names: couple.names,
      pronouns: couple.pronouns,
      description: couple.description,
      energy_profile: couple.energy_profile,
      best_day_ever: couple.best_day_ever,
      excited_about: couple.excited_about,
      nervous_about: couple.nervous_about,
    };

    const [coupleRes, weddingRes] = await Promise.all([
      supabase.from("couples").update(coupleData).eq("id", couple.id),
      supabase.from("weddings").update({ brief_couple_data: coupleData }).eq("id", id),
    ]);

    if (coupleRes.error || weddingRes.error) { setSaveStatus("error"); return; }
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [couple, id]);

  function updateWedding(field: keyof WeddingDetail, value: string | null) {
    setWedding((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  function updateCouple(field: keyof CoupleInfo, value: string | null) {
    setCouple((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  function updateEnergyProfile(key: string, value: string | number | null) {
    setCouple((prev) => {
      if (!prev) return prev;
      return { ...prev, energy_profile: { ...prev.energy_profile, [key]: value } };
    });
  }

  // Debounced autosave for wedding changes
  useEffect(() => {
    if (initialLoadRef.current || !wedding) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveWedding, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [saveWedding]);

  // Debounced autosave for couple changes
  useEffect(() => {
    if (initialLoadRef.current || !couple) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveCouple, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [saveCouple]);

  if (loading || !wedding) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "Wedding not found"}</p>
      </div>
    );
  }

  const formattedDate = new Date(wedding.date + "T12:00:00").toLocaleDateString(
    "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <div className="flex flex-col p-4">
      {/* Back + autosave */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/admin/weddings"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Weddings
        </Link>
        <AutosaveIndicator status={saveStatus} />
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {couple?.names || "Unnamed Couple"}
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
          <span className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            wedding.team_confirmation_status === "Scheduled"
              ? "bg-success/15 text-success" : "bg-warning-fill text-warning-text"
          )}>
            {wedding.team_confirmation_status || "Not Confirmed"}
          </span>
          <span className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            wedding.status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          )}>
            {wedding.status}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-3">
        <Link href={`/admin/weddings/${id}/brief`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-3.5" />
            Edit Brief
          </Button>
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddShooter(true)}>
          <UserPlus className="size-3.5" />
          Add Shooter
        </Button>
      </div>

      {/* Add Shooter Panel */}
      {showAddShooter && (
        <AddShooterPanel
          weddingId={id}
          weddingDate={wedding.date}
          weddingDetail={wedding}
          coupleName={couple?.names || ""}
          venueName={wedding.venue_name || ""}
          assignedShooterIds={assignments.map((a) => a.shooter_profiles?.id || "").filter(Boolean)}
          assignedRoles={assignments.map((a) => a.role)}
          onClose={() => setShowAddShooter(false)}
          onAssigned={loadAssignments}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column */}
        <div>
          {/* Service Details */}
          <CollapsibleSection title="Service Details" id="wedding-service-details" defaultOpen>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={Camera} label="Services">
                <EditableCell value={wedding.services || ""} onChange={(v) => updateWedding("services", v || null)} placeholder="Photo + Video" />
              </InfoRow>
              <InfoRow icon={FileText} label="Package">
                <EditableCell value={wedding.package || ""} onChange={(v) => updateWedding("package", v || null)} placeholder="Essential" />
              </InfoRow>
              <InfoRow icon={Clock} label="Coverage">
                <EditableCell value={wedding.hours_of_coverage || ""} onChange={(v) => updateWedding("hours_of_coverage", v || null)} placeholder="8 hrs" />
              </InfoRow>
              <InfoRow icon={User} label="Planner">
                <EditableCell value={wedding.planner_name || ""} onChange={(v) => updateWedding("planner_name", v || null)} placeholder="Ashley" />
              </InfoRow>
            </div>
          </CollapsibleSection>

          {/* Staffing */}
          <CollapsibleSection title={`Staffing — ${assignments.length} assigned`} id="wedding-staffing" defaultOpen>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <Camera className="mx-auto mb-1 size-4 text-primary" />
                <p className="text-lg font-semibold text-foreground">{wedding.num_photographers}</p>
                <p className="text-[10px] text-muted-foreground">Photographers</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <Video className="mx-auto mb-1 size-4 text-accent" />
                <p className="text-lg font-semibold text-foreground">{wedding.num_videographers}</p>
                <p className="text-[10px] text-muted-foreground">Videographers</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <Users className="mx-auto mb-1 size-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">{wedding.num_assistants}</p>
                <p className="text-[10px] text-muted-foreground">Assistants</p>
              </div>
            </div>
            {/* Team list */}
            {assignments.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">No shooters assigned</p>
            ) : (
              <div className="space-y-1.5">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted">
                        {a.shooter_profiles?.headshot_url ? (
                          <Image src={a.shooter_profiles.headshot_url} alt={a.shooter_profiles.name} fill className="object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[9px] font-bold text-muted-foreground">
                            {a.shooter_profiles?.name.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{a.shooter_profiles?.name}</p>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <RoleIcon role={a.role} size="xs" />
                          {ROLE_LABELS[a.role] || a.role}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 rounded-full", a.brief_read ? "bg-success" : "bg-muted-foreground/30")} title={a.brief_read ? "Brief read" : "Unread"} />
                      <span className={cn("size-1.5 rounded-full", a.quiz_passed ? "bg-success" : "bg-muted-foreground/30")} title={a.quiz_passed ? "Quiz passed" : "Not passed"} />
                      <button type="button" onClick={() => removeAssignment(a.id)} className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-error/10 hover:text-error" title="Remove">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Couple Profile */}
          {couple && (
            <CollapsibleSection title="Couple Profile" id="wedding-couple-profile" defaultOpen>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={User} label="Names">
                    <EditableCell value={couple.names} onChange={(v) => updateCouple("names", v)} />
                  </InfoRow>
                  <InfoRow icon={User} label="Pronouns">
                    <EditableCell value={couple.pronouns || ""} onChange={(v) => updateCouple("pronouns", v || null)} placeholder="she/her & he/him" />
                  </InfoRow>
                </div>
                <InfoRow icon={FileText} label="Description">
                  <EditableCell value={couple.description || ""} onChange={(v) => updateCouple("description", v || null)} placeholder="High school sweethearts..." />
                </InfoRow>
                <div className="grid grid-cols-3 gap-3">
                  <InfoRow icon={User} label="Energy">
                    <EditableCell type="select" options={ENERGY_OPTIONS} value={(couple.energy_profile?.general_energy as string) || ""} onChange={(v) => updateEnergyProfile("general_energy", v || null)} />
                  </InfoRow>
                  <InfoRow icon={User} label="Affection">
                    <EditableCell type="select" options={AFFECTION_OPTIONS} value={(couple.energy_profile?.affection_style as string) || ""} onChange={(v) => updateEnergyProfile("affection_style", v || null)} />
                  </InfoRow>
                  <InfoRow icon={User} label="Under stress">
                    <EditableCell type="select" options={STRESS_OPTIONS} value={(couple.energy_profile?.stress_style as string) || ""} onChange={(v) => updateEnergyProfile("stress_style", v || null)} />
                  </InfoRow>
                </div>
                <InfoRow icon={FileText} label="Best day ever">
                  <EditableCell type="textarea" value={couple.best_day_ever || ""} onChange={(v) => updateCouple("best_day_ever", v || null)} placeholder="In their words..." />
                </InfoRow>
                <InfoRow icon={FileText} label="Excited about">
                  <EditableCell type="textarea" value={couple.excited_about || ""} onChange={(v) => updateCouple("excited_about", v || null)} placeholder="First dance, the party..." />
                </InfoRow>
                <InfoRow icon={FileText} label="Nervous about">
                  <EditableCell type="textarea" value={couple.nervous_about || ""} onChange={(v) => updateCouple("nervous_about", v || null)} placeholder="Rain, speeches..." />
                </InfoRow>
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Locations */}
          <CollapsibleSection title="Locations" id="wedding-locations" defaultOpen>
            <div className="space-y-3">
              <InfoRow icon={MapPin} label="Reception">
                <EditableCell value={wedding.venue_name || ""} onChange={(v) => updateWedding("venue_name", v || null)} placeholder="Venue name" />
                <EditableCell value={wedding.venue_address || ""} onChange={(v) => updateWedding("venue_address", v || null)} placeholder="Address" displayClassName="text-xs text-muted-foreground" />
              </InfoRow>
              <InfoRow icon={MapPin} label="Ceremony">
                <EditableCell value={wedding.ceremony_location || ""} onChange={(v) => updateWedding("ceremony_location", v || null)} placeholder="Ceremony location" />
              </InfoRow>
              <InfoRow icon={MapPin} label="Getting Ready">
                <EditableCell value={wedding.getting_ready_location || ""} onChange={(v) => updateWedding("getting_ready_location", v || null)} placeholder="Getting ready location" />
              </InfoRow>
            </div>
          </CollapsibleSection>

          {/* Logistics */}
          <CollapsibleSection title="Logistics" id="wedding-logistics" defaultOpen>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={User} label="Coordinator">
                <EditableCell value={wedding.coordinator_name || ""} onChange={(v) => updateWedding("coordinator_name", v || null)} placeholder="Name" />
              </InfoRow>
              <InfoRow icon={User} label="Coordinator Phone">
                <EditableCell value={wedding.coordinator_phone || ""} onChange={(v) => updateWedding("coordinator_phone", v || null)} placeholder="Phone" />
              </InfoRow>
              <InfoRow icon={FileText} label="Gear Notes">
                <EditableCell value={wedding.gear_notes || ""} onChange={(v) => updateWedding("gear_notes", v || null)} placeholder="Gear pack..." />
              </InfoRow>
              <InfoRow icon={FileText} label="Meal Plan">
                <EditableCell value={wedding.meal_plan || ""} onChange={(v) => updateWedding("meal_plan", v || null)} placeholder="Vendor meal" />
              </InfoRow>
              <InfoRow icon={Clock} label="Wrap Time">
                <EditableCell value={wedding.wrap_time || ""} onChange={(v) => updateWedding("wrap_time", v || null)} placeholder="10:00 PM" />
              </InfoRow>
              <InfoRow icon={Clock} label="File Deadline">
                <EditableCell value={wedding.file_deadline || ""} onChange={(v) => updateWedding("file_deadline", v || null)} placeholder="2 weeks" />
              </InfoRow>
              <InfoRow icon={FileText} label="Dress Code">
                <EditableCell value={wedding.dress_code || ""} onChange={(v) => updateWedding("dress_code", v || null)} placeholder="All black" />
              </InfoRow>
              <InfoRow icon={FileText} label="Team Notes">
                <EditableCell type="textarea" value={wedding.team_notes || ""} onChange={(v) => updateWedding("team_notes", v || null)} placeholder="Coordination notes..." />
              </InfoRow>
            </div>
          </CollapsibleSection>

          {/* Documents */}
          {(wedding.timeline_couple_url || wedding.moodboard_url || wedding.family_checklist_url || wedding.timeline_internal_url) && (
            <CollapsibleSection title="Documents" id="wedding-documents" defaultOpen>
              <div className="space-y-1.5">
                {wedding.timeline_couple_url && <DocLink label="Couple Timeline" url={wedding.timeline_couple_url} />}
                {wedding.timeline_internal_url && <DocLink label="Internal Timeline" url={wedding.timeline_internal_url} />}
                {wedding.moodboard_url && <DocLink label="Moodboard Notes" url={wedding.moodboard_url} />}
                {wedding.family_checklist_url && <DocLink label="Family Shot Checklist" url={wedding.family_checklist_url} />}
              </div>
            </CollapsibleSection>
          )}

          {/* Add-ons */}
          {wedding.add_ons && wedding.add_ons.length > 0 && (
            <CollapsibleSection title="Add-Ons" id="wedding-add-ons" defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {wedding.add_ons.map((addon, i) => (
                  <span key={i} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-foreground">{addon}</span>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
      <FileText className="size-3.5 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ExternalLink className="size-3 text-muted-foreground" />
    </a>
  );
}

// --- Add Shooter Panel (unchanged logic, included here) ---

function getNeededRoles(wedding: WeddingDetail): string[] {
  const roles: string[] = [];
  const svc = wedding.services?.toLowerCase() || "";
  if (svc.includes("photo")) {
    if (wedding.num_photographers >= 1) roles.push("lead_photo");
    if (wedding.num_photographers >= 2) roles.push("second_photo");
  }
  if (svc.includes("video")) {
    if (wedding.num_videographers >= 1) roles.push("lead_video");
    if (wedding.num_videographers >= 2) roles.push("second_video");
  }
  if (wedding.num_assistants > 0) roles.push("photobooth");
  if (wedding.add_ons?.some((a) => a.toLowerCase().includes("drone"))) roles.push("drone");
  return roles;
}

function AddShooterPanel({
  weddingId, weddingDate, weddingDetail, coupleName, venueName,
  assignedShooterIds, assignedRoles, onClose, onAssigned,
}: {
  weddingId: string; weddingDate: string; weddingDetail: WeddingDetail;
  coupleName: string; venueName: string; assignedShooterIds: string[];
  assignedRoles: string[]; onClose: () => void; onAssigned: () => void;
}) {
  const [shooters, setShooters] = useState<{ id: string; name: string; headshot_url: string | null; roles: string[] }[]>([]);
  const [loadingShooters, setLoadingShooters] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const neededRoles = getNeededRoles(weddingDetail);
  const unfilledRoles = neededRoles.filter((r) => !assignedRoles.includes(r));

  useEffect(() => {
    async function loadAvailable() {
      const supabase = createClient();
      const { data: allShooters } = await supabase.from("shooter_profiles").select("id, name, headshot_url, roles").order("name");
      const { data: blockedData } = await supabase.from("blocked_dates").select("shooter_id").eq("date", weddingDate);
      const blockedIds = new Set(blockedData?.map((b) => b.shooter_id) || []);
      const assignedIds = new Set(assignedShooterIds);
      const available = (allShooters || []).filter((s) => !blockedIds.has(s.id) && !assignedIds.has(s.id) && s.roles.some((r: string) => unfilledRoles.includes(r)));
      setShooters(available);
      setLoadingShooters(false);
    }
    loadAvailable();
  }, [weddingDate, assignedShooterIds, unfilledRoles.join(",")]);

  async function handleQuickAssign(shooterId: string, role: string) {
    setError(""); setAssigningId(shooterId);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("assignments").insert({ wedding_id: weddingId, shooter_id: shooterId, role });
    if (insertError) { setError(insertError.message); setAssigningId(null); return; }

    const shooter = shooters.find((s) => s.id === shooterId);
    if (shooter) {
      const { data: profileData } = await supabase.from("shooter_profiles").select("user_id").eq("id", shooterId).single();
      if (profileData) {
        const { data: userData } = await supabase.from("users").select("email").eq("id", profileData.user_id).single();
        if (userData?.email) {
          const fDate = new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: userData.email, subject: `You've been assigned to ${coupleName}'s wedding`, html: `<h2>New Wedding Assignment</h2><p>You've been assigned as <strong>${ROLE_LABELS[role] || role}</strong> for <strong>${coupleName}</strong>'s wedding.</p><ul><li><strong>Date:</strong> ${fDate}</li><li><strong>Venue:</strong> ${venueName || "TBD"}</li></ul><p><a href="${typeof window !== "undefined" ? window.location.origin : ""}/dashboard">View in PreWedd Crew</a></p>` }) });
        }
      }
    }
    setAssigningId(null); onAssigned();
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Add Shooter</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Available shooters with matching roles</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
      </div>
      {unfilledRoles.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Needed:</span>
          {unfilledRoles.map((r) => <RoleIcon key={r} role={r} size="sm" showLabel />)}
        </div>
      )}
      {error && <p className="mb-2 text-xs text-error">{error}</p>}
      {loadingShooters ? <p className="py-4 text-center text-xs text-muted-foreground">Loading...</p>
        : shooters.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">{unfilledRoles.length === 0 ? "All roles filled." : "No available shooters."}</p>
        : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {shooters.map((s) => {
              const matchingRoles = s.roles.filter((r: string) => unfilledRoles.includes(r));
              return (
                <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted">
                    {s.headshot_url ? <Image src={s.headshot_url} alt={s.name} fill className="object-cover" /> : <div className="flex size-full items-center justify-center text-[9px] font-bold text-muted-foreground">{s.name.charAt(0)}</div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{s.name}</p>
                    <RoleIcons roles={s.roles} size="xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    {matchingRoles.map((role: string) => (
                      <button key={role} type="button" disabled={assigningId === s.id} onClick={() => handleQuickAssign(s.id, role)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50" title={`Assign as ${ROLE_LABELS[role]}`}>
                        <RoleIcon role={role} size="xs" />
                        <span className="hidden sm:inline">{assigningId === s.id ? "..." : "Assign"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      <div className="mt-3 flex justify-end"><Button type="button" variant="outline" size="sm" onClick={onClose}>Done</Button></div>
    </div>
  );
}
