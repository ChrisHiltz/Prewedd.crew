"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, ArrowRight } from "lucide-react";

interface StepBasicInfoProps {
  userId: string;
  userEmail: string;
  profileId: string | null;
  onComplete: (profileId?: string) => void;
}

export function StepBasicInfo({
  userId,
  userEmail,
  profileId,
  onComplete,
}: StepBasicInfoProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }

    setHeadshotFile(file);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => setHeadshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim() || !bio.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!headshotFile && !profileId) {
      setError("Please upload a headshot.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      let headshotUrl: string | undefined;

      // Upload headshot if new file selected
      if (headshotFile) {
        const ext = headshotFile.name.split(".").pop();
        const path = `${userId}/headshot.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("headshots")
          .upload(path, headshotFile, { upsert: true });

        if (uploadError) {
          setError(`Upload failed: ${uploadError.message}`);
          setSaving(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("headshots").getPublicUrl(path);

        headshotUrl = publicUrl;
      }

      const profileData = {
        user_id: userId,
        name: name.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        ...(headshotUrl && { headshot_url: headshotUrl }),
        onboarding_completed: false,
      };

      if (profileId) {
        // Update existing partial profile
        const { error: updateError } = await supabase
          .from("shooter_profiles")
          .update(profileData)
          .eq("id", profileId);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }
        onComplete();
      } else {
        // Insert new profile
        const { data, error: insertError } = await supabase
          .from("shooter_profiles")
          .insert(profileData)
          .select("id")
          .single();

        if (insertError) {
          setError(insertError.message);
          setSaving(false);
          return;
        }
        onComplete(data.id);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Basic Info</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Let&apos;s start with the basics.
        </p>
      </div>

      {/* Headshot upload */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-primary"
        >
          {headshotPreview ? (
            <Image
              src={headshotPreview}
              alt="Headshot preview"
              fill
              className="object-cover"
            />
          ) : (
            <Camera className="size-6 text-muted-foreground group-hover:text-primary" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="text-xs text-muted-foreground">
          Tap to upload headshot
        </span>
      </div>

      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Name <span className="text-error">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          readOnly
          value={userEmail}
          className="h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground"
        />
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor="phone"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Phone number <span className="text-error">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Bio */}
      <div>
        <label
          htmlFor="bio"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          One-line bio <span className="text-error">*</span>
        </label>
        <textarea
          id="bio"
          required
          maxLength={150}
          rows={2}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short intro couples will see — keep it warm and personal"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="mt-1 block text-right text-xs text-muted-foreground">
          {bio.length}/150
        </span>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <Button
        type="submit"
        disabled={saving}
        className="h-10 w-full gap-2 bg-primary text-white hover:bg-primary-hover"
      >
        {saving ? (
          "Saving..."
        ) : (
          <>
            Next
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
