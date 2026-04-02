"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Send } from "lucide-react";
import { AutosaveIndicator, type SaveStatus } from "@/components/ui/autosave-indicator";
import { cn } from "@/lib/utils";

interface TimelineBlock {
  time: string;
  event: string;
  approach_notes: string;
  key_shots: string;
  is_priority: boolean;
}

interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correct_index: number;
}

interface WeddingBriefData {
  id: string;
  couple_id: string;
  status: string;
  venue_name: string | null;
  venue_address: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  gear_notes: string | null;
  meal_plan: string | null;
  wrap_time: string | null;
  file_deadline: string | null;
  brief_couple_data: Record<string, unknown>;
  timeline: TimelineBlock[];
  quiz_questions: QuizQuestion[];
  couple_names: string;
}

const ENERGY_OPTIONS = ["Introverted", "Calm", "Balanced", "Outgoing", "High-energy"];
const AFFECTION_OPTIONS = ["Reserved", "Subtle", "Warm", "Playful", "Very affectionate"];
const STRESS_OPTIONS = ["Go with the flow", "Quiet adjustment", "Need reassurance", "Vocal about it"];

type TabId = "couple" | "logistics" | "timeline" | "quiz";

export default function BriefBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("couple");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const initialLoadRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wedding data
  const [weddingStatus, setWeddingStatus] = useState("draft");
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [coupleNames, setCoupleNames] = useState("");

  // Couple profile
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

  // Logistics
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorPhone, setCoordinatorPhone] = useState("");
  const [gearNotes, setGearNotes] = useState("");
  const [mealPlan, setMealPlan] = useState("");
  const [wrapTime, setWrapTime] = useState("");
  const [fileDeadline, setFileDeadline] = useState("");

  // Timeline
  const [timeline, setTimeline] = useState<TimelineBlock[]>([]);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  // Publishing
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("weddings")
        .select("*, couples(id, names, pronouns, description, energy_profile, best_day_ever, excited_about, nervous_about)")
        .eq("id", id)
        .single();

      if (data) {
        const couple = data.couples as unknown as {
          id: string; names: string; pronouns: string | null;
          description: string | null; energy_profile: Record<string, unknown>;
          best_day_ever: string | null; excited_about: string | null; nervous_about: string | null;
        } | null;

        setWeddingStatus(data.status || "draft");
        setCoupleId(data.couple_id);
        setCoupleNames(couple?.names || "");

        if (couple) {
          setNames(couple.names || "");
          setPronouns(couple.pronouns || "");
          setDescription(couple.description || "");
          const ep = couple.energy_profile || {};
          setGeneralEnergy((ep.general_energy as string) || "");
          setAffectionStyle((ep.affection_style as string) || "");
          setCameraComfort((ep.camera_comfort as number) || 3);
          setStressStyle((ep.stress_style as string) || "");
          setBestDayEver(couple.best_day_ever || "");
          setExcitedAbout(couple.excited_about || "");
          setNervousAbout(couple.nervous_about || "");
        }

        setVenueName(data.venue_name || "");
        setVenueAddress(data.venue_address || "");
        setCoordinatorName(data.coordinator_name || "");
        setCoordinatorPhone(data.coordinator_phone || "");
        setGearNotes(data.gear_notes || "");
        setMealPlan(data.meal_plan || "");
        setWrapTime(data.wrap_time || "");
        setFileDeadline(data.file_deadline || "");

        setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
        setQuizQuestions(Array.isArray(data.quiz_questions) ? data.quiz_questions : []);
      }

      setLoading(false);
      setTimeout(() => { initialLoadRef.current = false; }, 500);
    }
    load();
  }, [id]);

  const doSave = useCallback(async () => {
    if (initialLoadRef.current) return;
    setSaveStatus("saving");
    const supabase = createClient();

    const coupleData = {
      names: names.trim(), pronouns: pronouns.trim() || null,
      description: description.trim() || null,
      energy_profile: { general_energy: generalEnergy || null, affection_style: affectionStyle || null, camera_comfort: cameraComfort, stress_style: stressStyle || null },
      best_day_ever: bestDayEver.trim() || null,
      excited_about: excitedAbout.trim() || null,
      nervous_about: nervousAbout.trim() || null,
    };

    if (coupleId) {
      const { error: coupleError } = await supabase.from("couples").update(coupleData).eq("id", coupleId);
      if (coupleError) { setSaveStatus("error"); return; }
    }

    const { error: weddingError } = await supabase.from("weddings").update({
      venue_name: venueName.trim() || null, venue_address: venueAddress.trim() || null,
      coordinator_name: coordinatorName.trim() || null, coordinator_phone: coordinatorPhone.trim() || null,
      gear_notes: gearNotes.trim() || null, meal_plan: mealPlan.trim() || null,
      wrap_time: wrapTime.trim() || null, file_deadline: fileDeadline.trim() || null,
      brief_couple_data: coupleData, timeline, quiz_questions: quizQuestions,
    }).eq("id", id);

    const hasError = !!weddingError;
    setSaveStatus(hasError ? "error" : "saved");
    if (!hasError) setTimeout(() => setSaveStatus("idle"), 2000);
  }, [
    id, coupleId, names, pronouns, description, generalEnergy, affectionStyle,
    cameraComfort, stressStyle, bestDayEver, excitedAbout, nervousAbout,
    venueName, venueAddress, coordinatorName, coordinatorPhone,
    gearNotes, mealPlan, wrapTime, fileDeadline, timeline, quizQuestions,
  ]);

  useEffect(() => {
    if (initialLoadRef.current || loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [doSave, loading]);

  async function handlePublish() {
    if (quizQuestions.length < 5) return;
    setPublishing(true);

    // Save first
    await doSave();

    const supabase = createClient();
    await supabase.from("weddings").update({ status: "published" }).eq("id", id);
    setWeddingStatus("published");

    // Notify assigned shooters
    const { data: assignments } = await supabase
      .from("assignments")
      .select("shooter_profiles(user_id)")
      .eq("wedding_id", id);

    if (assignments) {
      for (const a of assignments) {
        const profile = a.shooter_profiles as unknown as { user_id: string } | null;
        if (!profile) continue;
        const { data: user } = await supabase.from("users").select("email").eq("id", profile.user_id).single();
        if (user?.email) {
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user.email,
              subject: `Brief published for ${coupleNames}'s wedding`,
              html: `<h2>Brief Ready</h2><p>The brief for <strong>${coupleNames}</strong>'s wedding has been published. Review it and take the quiz.</p><p><a href="${typeof window !== "undefined" ? window.location.origin : ""}/dashboard">Open PreWedd Crew</a></p>`,
            }),
          });
        }
      }
    }

    setPublishing(false);
  }

  // Stable keys for timeline blocks (survives reorder)
  const [timelineKeys, setTimelineKeys] = useState<string[]>([]);

  // Sync keys when timeline changes length
  useEffect(() => {
    setTimelineKeys((prev) => {
      if (prev.length === timeline.length) return prev;
      const next = [...prev];
      while (next.length < timeline.length) next.push(crypto.randomUUID());
      return next.slice(0, timeline.length);
    });
  }, [timeline.length]);

  // Timeline helpers
  function addTimelineBlock() {
    setTimeline((prev) => [...prev, { time: "", event: "", approach_notes: "", key_shots: "", is_priority: false }]);
    setTimelineKeys((prev) => [...prev, crypto.randomUUID()]);
  }
  function updateTimelineBlock(index: number, field: keyof TimelineBlock, value: string | boolean) {
    setTimeline((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  }
  function removeTimelineBlock(index: number) {
    setTimeline((prev) => prev.filter((_, i) => i !== index));
    setTimelineKeys((prev) => prev.filter((_, i) => i !== index));
  }
  function moveTimelineBlock(from: number, to: number) {
    setTimeline((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setTimelineKeys((prev) => {
      const next = [...prev];
      const [key] = next.splice(from, 1);
      next.splice(to, 0, key);
      return next;
    });
  }

  // Quiz helpers
  function addQuizQuestion() {
    setQuizQuestions((prev) => [...prev, { question: "", options: ["", "", "", ""], correct_index: 0 }]);
  }
  function updateQuizQuestion(index: number, field: string, value: unknown) {
    setQuizQuestions((prev) => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  }
  function updateQuizOption(qIndex: number, oIndex: number, value: string) {
    setQuizQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const opts = [...q.options] as [string, string, string, string];
      opts[oIndex] = value;
      return { ...q, options: opts };
    }));
  }
  function removeQuizQuestion(index: number) {
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: "couple", label: "Couple Profile" },
    { id: "logistics", label: "Logistics" },
    { id: "timeline", label: `Timeline (${timeline.length})` },
    { id: "quiz", label: `Quiz (${quizQuestions.length}/5)` },
  ];

  return (
    <div className="flex flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/admin/weddings/${id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Wedding
        </Link>
        <AutosaveIndicator status={saveStatus} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Brief — {coupleNames || "Couple"}</h1>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", weddingStatus === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
            {weddingStatus}
          </span>
          <Button
            onClick={handlePublish}
            disabled={quizQuestions.length < 5 || publishing || weddingStatus === "published"}
            size="sm"
            className="gap-1.5 bg-success text-white hover:bg-success/90 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            {publishing ? "Publishing..." : weddingStatus === "published" ? "Published" : "Publish"}
          </Button>
        </div>
      </div>

      {quizQuestions.length < 5 && weddingStatus !== "published" && (
        <p className="mb-4 text-xs text-warning-text">
          Add at least 5 quiz questions before publishing.
        </p>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Couple Profile Tab */}
      {activeTab === "couple" && (
        <div className="max-w-2xl space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Couple names" required><Input value={names} onChange={setNames} placeholder="Austin & JJ" /></Field>
            <Field label="Pronouns"><Input value={pronouns} onChange={setPronouns} placeholder="she/her & he/him" /></Field>
          </div>
          <Field label="One-line description"><Input value={description} onChange={setDescription} placeholder="High school sweethearts, both teachers" /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="General energy"><Select value={generalEnergy} onChange={setGeneralEnergy} options={ENERGY_OPTIONS} /></Field>
            <Field label="Affection style"><Select value={affectionStyle} onChange={setAffectionStyle} options={AFFECTION_OPTIONS} /></Field>
            <Field label="Stress style"><Select value={stressStyle} onChange={setStressStyle} options={STRESS_OPTIONS} /></Field>
          </div>
          <Field label={`Camera comfort (${cameraComfort}/5)`}>
            <input type="range" min="1" max="5" step="1" value={cameraComfort} onChange={(e) => setCameraComfort(parseInt(e.target.value, 10))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary" />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Camera shy</span><span>Love the camera</span></div>
          </Field>
          <Field label="Best day ever"><Textarea value={bestDayEver} onChange={setBestDayEver} placeholder="In their own words..." rows={3} /></Field>
          <Field label="Excited about"><Textarea value={excitedAbout} onChange={setExcitedAbout} placeholder="First dance, the party..." /></Field>
          <Field label="Nervous about"><Textarea value={nervousAbout} onChange={setNervousAbout} placeholder="Rain, speeches..." /></Field>
        </div>
      )}

      {/* Logistics Tab */}
      {activeTab === "logistics" && (
        <div className="max-w-2xl space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Venue name"><Input value={venueName} onChange={setVenueName} placeholder="The Grand Estate" /></Field>
            <Field label="Venue address"><Input value={venueAddress} onChange={setVenueAddress} placeholder="123 Main St" /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Coordinator name"><Input value={coordinatorName} onChange={setCoordinatorName} placeholder="Jane Smith" /></Field>
            <Field label="Coordinator phone"><Input value={coordinatorPhone} onChange={setCoordinatorPhone} placeholder="(555) 123-4567" /></Field>
          </div>
          <Field label="Gear notes"><Textarea value={gearNotes} onChange={setGearNotes} placeholder="Gear pack notes..." /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Meal plan"><Input value={mealPlan} onChange={setMealPlan} placeholder="Vendor meal" /></Field>
            <Field label="Wrap time"><Input value={wrapTime} onChange={setWrapTime} placeholder="10:00 PM" /></Field>
            <Field label="File deadline"><Input value={fileDeadline} onChange={setFileDeadline} placeholder="2 weeks" /></Field>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div className="max-w-3xl space-y-3">
          {timeline.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No timeline blocks yet. Add the first one below.</p>
          )}
          {timeline.map((block, i) => (
            <div key={timelineKeys[i] || i} className={cn("rounded-lg border bg-card p-4", block.is_priority ? "border-warning" : "border-border")}>
              <div className="mb-3 flex items-center gap-2">
                {(block.time || block.event) ? (
                  <span className="text-xs font-medium text-foreground">
                    {block.time && <span className="text-muted-foreground">{block.time}</span>}
                    {block.time && block.event && <span className="text-muted-foreground"> — </span>}
                    {block.event}
                  </span>
                ) : (
                  <span className="text-xs italic text-muted-foreground/50">New block</span>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveTimelineBlock(i, i - 1)}
                    className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="size-3" viewBox="0 0 12 12" fill="none"><path d="M6 2L2 7h8L6 2z" fill="currentColor"/></svg>
                  </button>
                  <button
                    type="button"
                    disabled={i === timeline.length - 1}
                    onClick={() => moveTimelineBlock(i, i + 1)}
                    className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="size-3" viewBox="0 0 12 12" fill="none"><path d="M6 10L2 5h8L6 10z" fill="currentColor"/></svg>
                  </button>
                </div>
                <button type="button" onClick={() => removeTimelineBlock(i)} className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-error/10 hover:text-error">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Time"><Input value={block.time} onChange={(v) => updateTimelineBlock(i, "time", v)} placeholder="2:00 PM" /></Field>
                <Field label="Event"><Input value={block.event} onChange={(v) => updateTimelineBlock(i, "event", v)} placeholder="First look" /></Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Approach notes"><Textarea value={block.approach_notes} onChange={(v) => updateTimelineBlock(i, "approach_notes", v)} placeholder="How to handle this moment..." /></Field>
                <Field label="Key shots"><Textarea value={block.key_shots} onChange={(v) => updateTimelineBlock(i, "key_shots", v)} placeholder="What to capture..." /></Field>
              </div>
              <label className="mt-3 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={block.is_priority}
                  onChange={(e) => updateTimelineBlock(i, "is_priority", e.target.checked)}
                  className="size-4 rounded border-border accent-warning"
                />
                <span className="text-xs font-medium text-foreground">Priority moment</span>
              </label>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addTimelineBlock} className="gap-1.5">
            <Plus className="size-3.5" />
            Add Timeline Block
          </Button>
        </div>
      )}

      {/* Quiz Tab */}
      {activeTab === "quiz" && (
        <div className="max-w-2xl space-y-4">
          <p className="text-xs text-muted-foreground">
            {quizQuestions.length} of 5 minimum questions.{" "}
            {quizQuestions.length >= 5 ? (
              <span className="text-success">Ready to publish.</span>
            ) : (
              <span className="text-warning-text">Add {5 - quizQuestions.length} more.</span>
            )}
          </p>

          {quizQuestions.map((q, qi) => (
            <div key={qi} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Question {qi + 1}</span>
                <button type="button" onClick={() => removeQuizQuestion(qi)} className="rounded p-1 text-muted-foreground hover:bg-error/10 hover:text-error">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Field label="Question">
                <Input value={q.question} onChange={(v) => updateQuizQuestion(qi, "question", v)} placeholder="What is the couple's first dance song?" />
              </Field>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`quiz-correct-${qi}`}
                      checked={q.correct_index === oi}
                      onChange={() => updateQuizQuestion(qi, "correct_index", oi)}
                      className="size-4 accent-success"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateQuizOption(qi, oi, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      className="h-8 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {q.correct_index === oi && (
                      <span className="text-[10px] font-medium text-success">Correct</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addQuizQuestion} className="gap-1.5">
            <Plus className="size-3.5" />
            Add Question
          </Button>
        </div>
      )}
    </div>
  );
}

// Shared form primitives
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}{required && <span className="text-error"> *</span>}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />;
}
function Textarea({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none">
      <option value="">Select...</option>
      {options.map((opt) => <option key={opt} value={opt.toLowerCase()}>{opt}</option>)}
    </select>
  );
}
