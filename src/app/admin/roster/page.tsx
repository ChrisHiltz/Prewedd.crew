"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronRight, UserPlus, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES_LIST = [
  { value: "lead_photo", label: "Lead Photographer" },
  { value: "second_photo", label: "Second Photographer" },
  { value: "lead_video", label: "Lead Videographer" },
  { value: "second_video", label: "Second Videographer" },
  { value: "photobooth", label: "Photobooth Operator" },
  { value: "drone", label: "Drone Operator" },
];

const ROLE_LABELS: Record<string, string> = {
  lead_photo: "Lead Photo",
  second_photo: "2nd Photo",
  lead_video: "Lead Video",
  second_video: "2nd Video",
  photobooth: "Photobooth",
  drone: "Drone",
};

const ALL_ROLES = [
  { value: "", label: "All Roles" },
  { value: "lead_photo", label: "Lead Photographer" },
  { value: "second_photo", label: "Second Photographer" },
  { value: "lead_video", label: "Lead Videographer" },
  { value: "second_video", label: "Second Videographer" },
  { value: "photobooth", label: "Photobooth Operator" },
  { value: "drone", label: "Drone Operator" },
];

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

interface Shooter {
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
  user_id: string;
}

export default function AdminRosterPage() {
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selected, setSelected] = useState<Shooter | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("shooter_profiles")
        .select("*")
        .order("name");

      if (data) setShooters(data as Shooter[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = shooters.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && !s.roles.includes(roleFilter)) return false;
    return true;
  });

  return (
    <div className="flex h-full">
      {/* Table area */}
      <div className={cn("flex flex-1 flex-col", selected && "hidden lg:flex")}>
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Team Roster</h1>
              <p className="text-sm text-muted-foreground">
                {shooters.length} shooter{shooters.length !== 1 ? "s" : ""} onboarded
              </p>
            </div>
            <InviteShooterButton />
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">No shooters found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Shooter</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Roles</th>
                  <th className="hidden px-4 py-2.5 text-xs font-medium text-muted-foreground md:table-cell">Type</th>
                  <th className="hidden px-4 py-2.5 text-xs font-medium text-muted-foreground lg:table-cell">Updated</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((shooter) => (
                  <tr
                    key={shooter.id}
                    onClick={() => setSelected(shooter)}
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors hover:bg-muted/50",
                      selected?.id === shooter.id && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-muted">
                          {shooter.headshot_url ? (
                            <Image
                              src={shooter.headshot_url}
                              alt={shooter.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-xs font-bold text-muted-foreground">
                              {shooter.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {shooter.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {shooter.roles.slice(0, 3).map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            {ROLE_LABELS[role] || role}
                          </span>
                        ))}
                        {shooter.roles.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{shooter.roles.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          shooter.is_employee
                            ? "bg-info-fill text-info"
                            : "bg-warning-fill text-warning-text"
                        )}
                      >
                        {shooter.is_employee ? "Employee" : "Contractor"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {new Date(shooter.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-2 py-3">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="flex w-full flex-col border-l border-border bg-card lg:w-[420px]">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Profile Detail</h2>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <DetailPanel
              shooter={selected}
              onSave={(updated) => {
                setSelected(updated);
                setShooters((prev) =>
                  prev.map((s) => (s.id === updated.id ? updated : s))
                );
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  shooter,
  onSave,
}: {
  shooter: Shooter;
  onSave: (updated: Shooter) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shooter.name);
  const [phone, setPhone] = useState(shooter.phone);
  const [pronouns, setPronouns] = useState(shooter.pronouns || "");
  const [bio, setBio] = useState(shooter.bio || "");
  const [isEmployee, setIsEmployee] = useState(shooter.is_employee);
  const [roles, setRoles] = useState<string[]>([...shooter.roles]);
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(shooter.rates).map(([k, v]) => [k, String(v)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset edit state when shooter changes
  useEffect(() => {
    setEditing(false);
    setName(shooter.name);
    setPhone(shooter.phone);
    setPronouns(shooter.pronouns || "");
    setBio(shooter.bio || "");
    setIsEmployee(shooter.is_employee);
    setRoles([...shooter.roles]);
    setRates(Object.fromEntries(Object.entries(shooter.rates).map(([k, v]) => [k, String(v)])));
    setError("");
  }, [shooter]);

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSave() {
    setError("");
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (roles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    const ratesObj: Record<string, number> = {};
    for (const role of roles) {
      const val = parseInt(rates[role] || "0", 10);
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
        name: name.trim(),
        phone: phone.trim(),
        pronouns: pronouns.trim() || null,
        bio: bio.trim(),
        is_employee: isEmployee,
        roles,
        rates: ratesObj,
      })
      .eq("id", shooter.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updated: Shooter = {
      ...shooter,
      name: name.trim(),
      phone: phone.trim(),
      pronouns: pronouns.trim() || null,
      bio: bio.trim(),
      is_employee: isEmployee,
      roles,
      rates: ratesObj,
      updated_at: new Date().toISOString(),
    };
    onSave(updated);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
          {shooter.headshot_url ? (
            <Image
              src={shooter.headshot_url}
              alt={shooter.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-lg font-bold text-muted-foreground">
              {shooter.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1">
          {editing ? (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 w-full rounded border border-border bg-background px-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
              />
              <input
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="Pronouns"
                className="mt-1 h-6 w-full rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-foreground">{shooter.name}</h3>
              {shooter.pronouns && (
                <p className="text-xs text-muted-foreground">{shooter.pronouns}</p>
              )}
            </>
          )}
          {editing ? (
            <div className="mt-1 flex rounded border border-border">
              <button
                type="button"
                onClick={() => setIsEmployee(false)}
                className={cn(
                  "flex-1 rounded-l px-2 py-0.5 text-[10px] font-medium",
                  !isEmployee ? "bg-primary text-white" : "text-muted-foreground"
                )}
              >
                Contractor
              </button>
              <button
                type="button"
                onClick={() => setIsEmployee(true)}
                className={cn(
                  "flex-1 rounded-r px-2 py-0.5 text-[10px] font-medium",
                  isEmployee ? "bg-primary text-white" : "text-muted-foreground"
                )}
              >
                Employee
              </button>
            </div>
          ) : (
            <span
              className={cn(
                "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                shooter.is_employee
                  ? "bg-info-fill text-info"
                  : "bg-warning-fill text-warning-text"
              )}
            >
              {shooter.is_employee ? "Employee" : "Contractor"}
            </span>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Edit
          </button>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      {/* Bio */}
      <div>
        <SectionLabel>Bio</SectionLabel>
        {editing ? (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={150}
            rows={2}
            className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        ) : (
          <p className="text-sm text-foreground">{shooter.bio || "—"}</p>
        )}
      </div>

      {/* Contact */}
      <div>
        <SectionLabel>Contact</SectionLabel>
        {editing ? (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        ) : (
          <p className="text-sm text-foreground">{shooter.phone}</p>
        )}
      </div>

      {/* Roles & Rates */}
      <div>
        <SectionLabel>Roles & Rates</SectionLabel>
        {editing ? (
          <div className="space-y-1.5">
            {ROLES_LIST.map((role) => {
              const selected = roles.includes(role.value);
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                      selected ? "border-primary bg-primary text-white" : "border-border"
                    )}
                  >
                    {selected && (
                      <svg className="size-2" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1">{role.label}</span>
                  {selected && (
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        value={rates[role.value] || ""}
                        onChange={(e) => {
                          e.stopPropagation();
                          setRates((prev) => ({ ...prev, [role.value]: e.target.value }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Rate"
                        className="h-5 w-14 rounded border border-border bg-background px-1 text-right text-[10px] text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {shooter.roles.map((role) => (
              <div
                key={role}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5"
              >
                <span className="text-xs font-medium text-foreground">
                  {ROLE_LABELS[role] || role}
                </span>
                {shooter.rates[role] && (
                  <span className="text-xs text-muted-foreground">${shooter.rates[role]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personality — read-only (admin views, shooter edits) */}
      <div>
        <SectionLabel>Personality</SectionLabel>
        <div className="space-y-2">
          {PERSONALITY_ITEMS.map((item) => {
            const score = shooter.personality_scores[item.key] || 3;
            return (
              <div key={item.key}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[11px] text-foreground">{item.label}</span>
                  <span className="text-[10px] font-semibold text-primary">{score}</span>
                </div>
                <div className="relative h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={{ width: `${((score - 1) / 4) * 100}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between">
                  <span className="text-[8px] text-muted-foreground">{item.low}</span>
                  <span className="text-[8px] text-muted-foreground">{item.high}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills — read-only (admin views, shooter edits) */}
      <div>
        <SectionLabel>Skills</SectionLabel>
        <div className="space-y-2">
          {SKILL_ITEMS.map((item) => {
            const score = shooter.skill_scores[item.key] || 3;
            return (
              <div key={item.key}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[11px] text-foreground">{item.label}</span>
                  <span className="text-[10px] font-semibold text-accent">{score}</span>
                </div>
                <div className="relative h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent"
                    style={{ width: `${((score - 1) / 4) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Updated */}
      <p className="text-[10px] text-muted-foreground">
        Updated{" "}
        {new Date(shooter.updated_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {/* Save/Cancel buttons */}
      {editing && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(shooter.name);
              setPhone(shooter.phone);
              setPronouns(shooter.pronouns || "");
              setBio(shooter.bio || "");
              setIsEmployee(shooter.is_employee);
              setRoles([...shooter.roles]);
              setRates(Object.fromEntries(Object.entries(shooter.rates).map(([k, v]) => [k, String(v)])));
              setError("");
            }}
            className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-primary py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function InviteShooterButton() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSending(true);

    const trimmedEmail = email.trim();
    const siteUrl = window.location.origin;

    // Step 1: Send the magic link (creates the auth user on first use)
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setSending(false);
      return;
    }

    // Step 2: Send a warm welcome email via Resend with context
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: trimmedEmail,
        subject: "Welcome to the team! Here's what's next",
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
  <div style="background: white; border-radius: 12px; padding: 32px 24px; border: 1px solid #e8d0d8;">
    <h2 style="font-size: 22px; color: #2e1a23; margin: 0 0 16px;">Hey, welcome to the crew!</h2>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 12px;">You've been invited to join the TLIC team portal. This is where you'll manage your wedding assignments, review couple briefs, check your schedule, and prep for each wedding day.</p>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 12px;">Here's how it works:</p>
    <ul style="font-size: 14px; color: #6b5660; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
      <li><strong style="color: #2e1a23;">Set up your profile</strong> - your roles, rates, and working style</li>
      <li><strong style="color: #2e1a23;">Get assigned to weddings</strong> - you'll see the couple, venue, and your role</li>
      <li><strong style="color: #2e1a23;">Review the brief</strong> - everything you need to know about the couple and the day</li>
      <li><strong style="color: #2e1a23;">Take the quiz</strong> - quick check to make sure you're prepped and ready</li>
      <li><strong style="color: #2e1a23;">Block your calendar</strong> - mark dates you're unavailable</li>
    </ul>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 24px;">You should've also received a separate sign-in email with a magic link. Tap that link to get started. No passwords needed, ever.</p>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 4px;">Excited to have you on the team!</p>
    <p style="font-size: 15px; color: #2e1a23; font-weight: 600; margin: 0;">- The TLIC Team</p>
  </div>
</div>`,
      }),
    });

    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setShowForm(false);
      setEmail("");
    }, 3000);
  }

  if (sent) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-success">
        <Check className="size-3.5" />
        Invite sent!
      </div>
    );
  }

  if (!showForm) {
    return (
      <Button
        size="sm"
        onClick={() => setShowForm(true)}
        className="gap-1.5 bg-primary text-white hover:bg-primary-hover"
      >
        <UserPlus className="size-3.5" />
        Invite Shooter
      </Button>
    );
  }

  return (
    <form onSubmit={handleInvite} className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="shooter@email.com"
        autoFocus
        className="h-8 w-48 rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <Button
        type="submit"
        size="sm"
        disabled={sending || !email.trim()}
        className="gap-1.5 bg-primary text-white hover:bg-primary-hover"
      >
        <Send className="size-3" />
        {sending ? "..." : "Send"}
      </Button>
      <button
        type="button"
        onClick={() => { setShowForm(false); setEmail(""); setError(""); }}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      {error && <span className="text-[10px] text-error">{error}</span>}
    </form>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}
