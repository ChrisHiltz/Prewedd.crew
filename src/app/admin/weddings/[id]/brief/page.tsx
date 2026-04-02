"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import { AutosaveIndicator, type SaveStatus } from "@/components/ui/autosave-indicator";
import { cn } from "@/lib/utils";

interface CoupleData {
  id: string;
  names: string;
  pronouns: string | null;
  description: string | null;
  energy_profile: {
    general_energy?: string;
    affection_style?: string;
    camera_comfort?: number;
    stress_style?: string;
  };
  best_day_ever: string | null;
  excited_about: string | null;
  nervous_about: string | null;
}

interface WeddingData {
  id: string;
  couple_id: string;
  venue_name: string | null;
  venue_address: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  gear_notes: string | null;
  meal_plan: string | null;
  wrap_time: string | null;
  file_deadline: string | null;
  brief_couple_data: Record<string, unknown>;
  couples: CoupleData | null;
}

const ENERGY_OPTIONS = ["Introverted", "Calm", "Balanced", "Outgoing", "High-energy"];
const AFFECTION_OPTIONS = ["Reserved", "Subtle", "Warm", "Playful", "Very affectionate"];
const STRESS_OPTIONS = ["Go with the flow", "Quiet adjustment", "Need reassurance", "Vocal about it"];

export default function BriefBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [wedding, setWedding] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"couple" | "logistics">("couple");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [initialLoad, setInitialLoad] = useState(true);

  // Couple profile form state
  const [names, setNames] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [description, setDescription] = useState("");
  const [generalEnergy, setGeneralEnergy] = useState("");
  const [affectionStyle, setAffectionStyle] = useState("");
  const [cameraComfort, setCameraComfort] = useState(3);
  const [stressStyle, setStressStyle] = useState("");
  const [bestDayEver, setBestDayEver] = useState("");
  const [excitedAbout, setExcitedAbout] = useState("");
  const [nervousAbout, setNervousAbout] = useState("");

  // Logistics form state
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorPhone, setCoordinatorPhone] = useState("");
  const [gearNotes, setGearNotes] = useState("");
  const [mealPlan, setMealPlan] = useState("");
  const [wrapTime, setWrapTime] = useState("");
  const [fileDeadline, setFileDeadline] = useState("");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coupleIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("weddings")
        .select("id, couple_id, venue_name, venue_address, coordinator_name, coordinator_phone, gear_notes, meal_plan, wrap_time, file_deadline, brief_couple_data, couples(id, names, pronouns, description, energy_profile, best_day_ever, excited_about, nervous_about)")
        .eq("id", id)
        .single();

      if (data) {
        const w = {
          ...data,
          couples: data.couples as unknown as CoupleData | null,
        };
        setWedding(w);
        coupleIdRef.current = w.couple_id;

        if (w.couples) {
          setNames(w.couples.names || "");
          setPronouns(w.couples.pronouns || "");
          setDescription(w.couples.description || "");
          setGeneralEnergy(w.couples.energy_profile?.general_energy || "");
          setAffectionStyle(w.couples.energy_profile?.affection_style || "");
          setCameraComfort(w.couples.energy_profile?.camera_comfort || 3);
          setStressStyle(w.couples.energy_profile?.stress_style || "");
          setBestDayEver(w.couples.best_day_ever || "");
          setExcitedAbout(w.couples.excited_about || "");
          setNervousAbout(w.couples.nervous_about || "");
        }

        setVenueName(w.venue_name || "");
        setVenueAddress(w.venue_address || "");
        setCoordinatorName(w.coordinator_name || "");
        setCoordinatorPhone(w.coordinator_phone || "");
        setGearNotes(w.gear_notes || "");
        setMealPlan(w.meal_plan || "");
        setWrapTime(w.wrap_time || "");
        setFileDeadline(w.file_deadline || "");
      }

      setLoading(false);
      // Small delay before enabling autosave to avoid saving on initial load
      setTimeout(() => setInitialLoad(false), 500);
    }
    load();
  }, [id]);

  const doSave = useCallback(async () => {
    if (!coupleIdRef.current) return;
    setSaveStatus("saving");

    const supabase = createClient();

    const coupleData = {
      names: names.trim(),
      pronouns: pronouns.trim() || null,
      description: description.trim() || null,
      energy_profile: {
        general_energy: generalEnergy || null,
        affection_style: affectionStyle || null,
        camera_comfort: cameraComfort,
        stress_style: stressStyle || null,
      },
      best_day_ever: bestDayEver.trim() || null,
      excited_about: excitedAbout.trim() || null,
      nervous_about: nervousAbout.trim() || null,
    };

    const { error: coupleError } = await supabase
      .from("couples")
      .update(coupleData)
      .eq("id", coupleIdRef.current);

    if (coupleError) {
      setSaveStatus("error");
      return;
    }

    const { error: weddingError } = await supabase
      .from("weddings")
      .update({
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
        coordinator_name: coordinatorName.trim() || null,
        coordinator_phone: coordinatorPhone.trim() || null,
        gear_notes: gearNotes.trim() || null,
        meal_plan: mealPlan.trim() || null,
        wrap_time: wrapTime.trim() || null,
        file_deadline: fileDeadline.trim() || null,
        brief_couple_data: coupleData,
      })
      .eq("id", id);

    if (weddingError) {
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [
    id, names, pronouns, description, generalEnergy, affectionStyle,
    cameraComfort, stressStyle, bestDayEver, excitedAbout, nervousAbout,
    venueName, venueAddress, coordinatorName, coordinatorPhone,
    gearNotes, mealPlan, wrapTime, fileDeadline,
  ]);

  // Debounced autosave — triggers 1s after last change
  useEffect(() => {
    if (initialLoad || loading) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      doSave();
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doSave, initialLoad, loading]);

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

  return (
    <div className="flex flex-col p-4">
      <Link
        href={`/admin/weddings/${id}`}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Wedding
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          Brief Builder — {names || "Couple"}
        </h1>
        <AutosaveIndicator status={saveStatus} />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("couple")}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "couple"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Couple Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("logistics")}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "logistics"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Logistics
        </button>
      </div>

      {/* Couple Profile Tab */}
      {activeTab === "couple" && (
        <div className="max-w-2xl space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Couple names" required>
              <input
                type="text"
                value={names}
                onChange={(e) => setNames(e.target.value)}
                placeholder="Austin & JJ"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Pronouns">
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="she/her & he/him"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>

          <Field label="One-line description">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="High school sweethearts, both teachers"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="General energy">
              <select
                value={generalEnergy}
                onChange={(e) => setGeneralEnergy(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Select...</option>
                {ENERGY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label="Affection style">
              <select
                value={affectionStyle}
                onChange={(e) => setAffectionStyle(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Select...</option>
                {AFFECTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label="Stress style">
              <select
                value={stressStyle}
                onChange={(e) => setStressStyle(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Select...</option>
                {STRESS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={`Camera comfort (${cameraComfort}/5)`}>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={cameraComfort}
              onChange={(e) => setCameraComfort(parseInt(e.target.value, 10))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Camera shy</span>
              <span>Love the camera</span>
            </div>
          </Field>

          <Field label="What does 'best day ever' mean to them?">
            <textarea
              value={bestDayEver}
              onChange={(e) => setBestDayEver(e.target.value)}
              rows={3}
              placeholder="In their own words from the planning call..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          <Field label="What are they most excited about?">
            <textarea
              value={excitedAbout}
              onChange={(e) => setExcitedAbout(e.target.value)}
              rows={2}
              placeholder="First dance, seeing each other, the party..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          <Field label="What are they nervous about?">
            <textarea
              value={nervousAbout}
              onChange={(e) => setNervousAbout(e.target.value)}
              rows={2}
              placeholder="Rain, speeches, family dynamics..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      )}

      {/* Logistics Tab */}
      {activeTab === "logistics" && (
        <div className="max-w-2xl space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Venue name">
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="The Grand Estate"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Venue address">
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="123 Main St, City, ST"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Coordinator name">
              <input
                type="text"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder="Jane Smith"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Coordinator phone">
              <input
                type="tel"
                value={coordinatorPhone}
                onChange={(e) => setCoordinatorPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>

          <Field label="Gear notes">
            <textarea
              value={gearNotes}
              onChange={(e) => setGearNotes(e.target.value)}
              rows={2}
              placeholder="Gear pack assignment notes..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Meal plan">
              <input
                type="text"
                value={mealPlan}
                onChange={(e) => setMealPlan(e.target.value)}
                placeholder="Vendor meal provided"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Wrap time">
              <input
                type="text"
                value={wrapTime}
                onChange={(e) => setWrapTime(e.target.value)}
                placeholder="10:00 PM"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="File deadline">
              <input
                type="text"
                value={fileDeadline}
                onChange={(e) => setFileDeadline(e.target.value)}
                placeholder="2 weeks after wedding"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {children}
    </div>
  );
}
