"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StepBasicInfo } from "@/components/onboarding/step-basic-info";
import { StepRolesRates } from "@/components/onboarding/step-roles-rates";
import { StepPersonality } from "@/components/onboarding/step-personality";
import { StepSkills } from "@/components/onboarding/step-skills";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Basic Info", "Roles & Rates", "Personality", "Skills"];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email || "");

      // Check if profile already exists (partial onboarding)
      const { data: profile } = await supabase
        .from("shooter_profiles")
        .select("id, onboarding_completed")
        .eq("user_id", user.id)
        .single();

      if (profile?.onboarding_completed) {
        router.push("/dashboard");
        return;
      }

      if (profile) {
        setProfileId(profile.id);
      }
    }
    loadUser();
  }, [router]);

  function handleStepComplete(newProfileId?: string) {
    if (newProfileId) {
      setProfileId(newProfileId);
    }
    setCurrentStep((s) => s + 1);
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress indicator */}
      <div className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-center justify-between">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep;
              return (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      isCompleted && "bg-success text-white",
                      isActive && "bg-primary text-white",
                      !isActive &&
                        !isCompleted &&
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? "✓" : stepNum}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 w-full rounded-full bg-muted">
            <div
              className="h-1 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {currentStep === 1 && (
            <StepBasicInfo
              userId={userId}
              userEmail={userEmail}
              profileId={profileId}
              onComplete={handleStepComplete}
            />
          )}
          {currentStep === 2 && profileId && (
            <StepRolesRates
              profileId={profileId}
              onComplete={() => handleStepComplete()}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && profileId && (
            <StepPersonality
              profileId={profileId}
              onComplete={() => handleStepComplete()}
              onBack={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 4 && profileId && (
            <StepSkills
              profileId={profileId}
              onBack={() => setCurrentStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

