"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES_LIST = [
  { value: "lead_photo", label: "Lead Photographer" },
  { value: "second_photo", label: "Second Photographer" },
  { value: "lead_video", label: "Lead Videographer" },
  { value: "second_video", label: "Second Videographer" },
  { value: "photobooth", label: "Photobooth Operator" },
  { value: "drone", label: "Drone Operator" },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES_LIST.map((r) => [r.value, r.label])
);

const PERSONALITY_ITEMS = [
  { key: "energy", label: "Energy", low: "Calm", high: "Hype" },
  { key: "directing", label: "Directing", low: "Documentary", high: "Directed" },
  { key: "communication", label: "Communication", low: "Quiet", high: "Chatty" },
  { key: "pressure", label: "Pressure", low: "Calm", high: "Rally" },
  { key: "teamwork", label: "Teamwork", low: "Independent", high: "Coordinate" },
  { key: "shy_couples", label: "Shy couples", low: "Space", high: "Draw out" },
  { key: "philosophy", label: "Philosophy", low: "Natural", high: "Create" },
  { key: "downtime", label: "Downtime", low: "Candids", high: "Near couple" },
];

const SKILL_ITEMS = [
  { key: "getting_ready", label: "Getting ready" },
  { key: "details", label: "Details" },
  { key: "ceremony", label: "Ceremony" },
  { key: "portraits_posed", label: "Posed portraits" },
  { key: "portraits_candid", label: "Candid portraits" },
  { key: "wedding_party", label: "Wedding party" },
  { key: "family_formals", label: "Family formals" },
  { key: "cocktail_hour", label: "Cocktail hour" },
  { key: "reception", label: "Reception" },
  { key: "dance_floor", label: "Dance floor" },
  { key: "harsh_light", label: "Harsh light" },
  { key: "low_light", label: "Low light" },
  { key: "flash", label: "Flash" },
  { key: "drone", label: "Drone / aerial" },
];

interface Profile {
  id: string;
  name: string;
  phone: string;
  pronouns: string | null;
  bio: string | null;
  headshot_url: string | null;
  is_employee: boolean;
  roles: string[];
  rates: Record<string, number>;
  personality_scores: Record<string, number>;
  skill_scores: Record<string, number>;
  updated_at: string;
}

interface EditState {
  name: string;
  phone: string;
  pronouns: string;
  bio: string;
  is_employee: boolean;
  roles: string[];
  rates: Record<string, string>;
  personality_scores: Record<string, number>;
  skill_scores: Record<string, number>;
}

function profileToEdit(p: Profile): EditState {
  return {
    name: p.name,
    phone: p.phone,
    pronouns: p.pronouns || "",
    bio: p.bio || "",
    is_employee: p.is_employee,
    roles: [...p.roles],
    rates: Object.fromEntries(
      Object.entries(p.rates).map(([k, v]) => [k, String(v)])
    ),
    personality_scores: { ...p.personality_scores },
    skill_scores: { ...p.skill_scores },
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data } = await supabase
        .from("shooter_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) setProfile(data as Profile);
    }
    load();
  }, []);

  function startEditing() {
    if (!profile) return;
    setEdit(profileToEdit(profile));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEdit(null);
    setError("");
  }

  function toggleRole(role: string) {
    if (!edit) return;
    const has = edit.roles.includes(role);
    setEdit({
      ...edit,
      roles: has ? edit.roles.filter((r) => r !== role) : [...edit.roles, role],
    });
  }

  async function handleSave() {
    if (!profile || !edit) return;
    setError("");

    if (!edit.name.trim() || !edit.phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (edit.roles.length === 0) {
      setError("Select at least one role.");
      return;
    }

    const ratesObj: Record<string, number> = {};
    for (const role of edit.roles) {
      const val = parseInt(edit.rates[role] || "0", 10);
      if (!val || val <= 0) {
        setError(`Enter a rate for ${ROLE_LABELS[role]}.`);
        return;
      }
      ratesObj[role] = val;
    }

    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("shooter_profiles")
      .update({
        name: edit.name.trim(),
        phone: edit.phone.trim(),
        pronouns: edit.pronouns.trim() || null,
        bio: edit.bio.trim(),
        is_employee: edit.is_employee,
        roles: edit.roles,
        rates: ratesObj,
        personality_scores: edit.personality_scores,
        skill_scores: edit.skill_scores,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfile({
      ...profile,
      name: edit.name.trim(),
      phone: edit.phone.trim(),
      pronouns: edit.pronouns.trim() || null,
      bio: edit.bio.trim(),
      is_employee: edit.is_employee,
      roles: edit.roles,
      rates: ratesObj,
      personality_scores: edit.personality_scores,
      skill_scores: edit.skill_scores,
      updated_at: new Date().toISOString(),
    });
    setEditing(false);
    setEdit(null);
  }

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted">
          {profile.headshot_url ? (
            <Image
              src={profile.headshot_url}
              alt={profile.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {profile.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1">
          {editing && edit ? (
            <>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="h-8 w-full rounded border border-border bg-background px-2 text-lg font-semibold text-foreground focus:border-primary focus:outline-none"
              />
              <input
                value={edit.pronouns}
                onChange={(e) => setEdit({ ...edit, pronouns: e.target.value })}
                placeholder="Pronouns"
                className="mt-1 h-7 w-full rounded border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground">{profile.name}</h1>
              {profile.pronouns && (
                <p className="text-sm text-muted-foreground">{profile.pronouns}</p>
              )}
            </>
          )}
          <div className="mt-1 flex gap-2">
            {editing && edit ? (
              <div className="flex rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setEdit({ ...edit, is_employee: false })}
                  className={cn(
                    "rounded-l-lg px-3 py-1 text-[10px] font-medium transition-colors",
                    !edit.is_employee
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground"
                  )}
                >
                  Contractor
                </button>
                <button
                  type="button"
                  onClick={() => setEdit({ ...edit, is_employee: true })}
                  className={cn(
                    "rounded-r-lg px-3 py-1 text-[10px] font-medium transition-colors",
                    edit.is_employee
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground"
                  )}
                >
                  Employee
                </button>
              </div>
            ) : (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  profile.is_employee
                    ? "bg-info-fill text-info"
                    : "bg-warning-fill text-warning-text"
                )}
              >
                {profile.is_employee ? "Employee" : "Contractor"}
              </span>
            )}
          </div>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
            <Pencil className="size-3" />
            Edit
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Bio */}
      <Section title="Bio">
        {editing && edit ? (
          <div>
            <textarea
              value={edit.bio}
              onChange={(e) => setEdit({ ...edit, bio: e.target.value })}
              maxLength={150}
              rows={2}
              className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[10px] text-muted-foreground">{edit.bio.length}/150</span>
          </div>
        ) : (
          <p className="text-sm text-foreground">{profile.bio || "—"}</p>
        )}
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <div className="space-y-1 text-sm">
          <p className="text-foreground">{email}</p>
          {editing && edit ? (
            <input
              value={edit.phone}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
              className="h-8 w-full rounded border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          ) : (
            <p className="text-foreground">{profile.phone}</p>
          )}
        </div>
      </Section>

      {/* Roles & Rates */}
      <Section title="Roles & Rates">
        {editing && edit ? (
          <div className="space-y-2">
            {ROLES_LIST.map((role) => {
              const selected = edit.roles.includes(role.value);
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      selected ? "border-primary bg-primary text-white" : "border-border"
                    )}
                  >
                    {selected && (
                      <svg className="size-2.5" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1">{role.label}</span>
                  {selected && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        value={edit.rates[role.value] || ""}
                        onChange={(e) => {
                          e.stopPropagation();
                          setEdit({
                            ...edit,
                            rates: { ...edit.rates, [role.value]: e.target.value },
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Rate"
                        className="h-6 w-16 rounded border border-border bg-background px-1.5 text-right text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.roles.map((role) => (
              <div
                key={role}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1"
              >
                <span className="text-xs font-medium text-foreground">
                  {ROLE_LABELS[role] || role}
                </span>
                {profile.rates[role] && (
                  <span className="text-xs text-muted-foreground">${profile.rates[role]}</span>
                )}
              </div>
            ))}
            {profile.roles.length === 0 && (
              <p className="text-sm text-muted-foreground">No roles set</p>
            )}
          </div>
        )}
      </Section>

      {/* Personality */}
      <Section title="Personality">
        <div className="space-y-3">
          {PERSONALITY_ITEMS.map((item) => {
            const score = editing && edit
              ? edit.personality_scores[item.key] || 3
              : profile.personality_scores[item.key] || 3;
            return (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {score}
                  </span>
                </div>
                {editing && edit ? (
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={score}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        personality_scores: {
                          ...edit.personality_scores,
                          [item.key]: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  />
                ) : (
                  <div className="relative h-2 w-full rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                      style={{ width: `${((score - 1) / 4) * 100}%` }}
                    />
                  </div>
                )}
                <div className="mt-0.5 flex justify-between">
                  <span className="text-[9px] text-muted-foreground">{item.low}</span>
                  <span className="text-[9px] text-muted-foreground">{item.high}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Skills */}
      <Section title="Skills">
        <div className="space-y-3">
          {SKILL_ITEMS.map((item) => {
            const score = editing && edit
              ? edit.skill_scores[item.key] || 3
              : profile.skill_scores[item.key] || 3;
            return (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    {score}
                  </span>
                </div>
                {editing && edit ? (
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={score}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        skill_scores: {
                          ...edit.skill_scores,
                          [item.key]: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-accent"
                  />
                ) : (
                  <div className="relative h-2 w-full rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
                      style={{ width: `${((score - 1) / 4) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Last updated */}
      <p className="text-xs text-muted-foreground">
        Last updated:{" "}
        {new Date(profile.updated_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {/* Sticky save/cancel bar */}
      {editing && (
        <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-border bg-background px-4 py-3">
          <div className="mx-auto flex max-w-lg gap-3">
            <Button
              variant="outline"
              onClick={cancelEditing}
              className="h-10 flex-1 gap-1.5"
            >
              <X className="size-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 flex-1 gap-1.5 bg-primary text-white hover:bg-primary-hover"
            >
              <Save className="size-4" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
