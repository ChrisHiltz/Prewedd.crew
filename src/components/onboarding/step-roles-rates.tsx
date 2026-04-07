"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELECTABLE_ROLES as ROLES } from "@/lib/utils/roles";

interface StepRolesRatesProps {
  profileId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function StepRolesRates({
  profileId,
  onComplete,
  onBack,
}: StepRolesRatesProps) {
  const [isEmployee, setIsEmployee] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (selectedRoles.length === 0) {
      setError("Please select at least one role.");
      return;
    }

    // Build rates object — only for selected roles
    const ratesObj: Record<string, number> = {};
    for (const role of selectedRoles) {
      const rate = parseInt(rates[role] || "0", 10);
      if (!rate || rate <= 0) {
        setError(`Please enter a rate for ${ROLES.find((r) => r.value === role)?.label}.`);
        return;
      }
      ratesObj[role] = rate;
    }

    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("shooter_profiles")
      .update({
        is_employee: isEmployee,
        roles: selectedRoles,
        rates: ratesObj,
      })
      .eq("id", profileId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onComplete();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Roles & Rates
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What do you shoot, and what do you charge?
        </p>
      </div>

      {/* Employee / Contractor toggle */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Employment type
        </label>
        <div className="flex rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setIsEmployee(false)}
            className={cn(
              "flex-1 rounded-l-lg px-4 py-2 text-sm font-medium transition-colors",
              !isEmployee
                ? "bg-primary text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Contractor
          </button>
          <button
            type="button"
            onClick={() => setIsEmployee(true)}
            className={cn(
              "flex-1 rounded-r-lg px-4 py-2 text-sm font-medium transition-colors",
              isEmployee
                ? "bg-primary text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Employee
          </button>
        </div>
      </div>

      {/* Role checkboxes */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Available roles <span className="text-error">*</span>
        </label>
        <div className="space-y-2">
          {ROLES.map((role) => {
            const isSelected = selectedRoles.includes(role.value);
            return (
              <div key={role.value}>
                <button
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-border"
                    )}
                  >
                    {isSelected && (
                      <svg className="size-3" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1">{role.label}</span>
                  {isSelected && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        value={rates[role.value] || ""}
                        onChange={(e) => {
                          e.stopPropagation();
                          setRates((prev) => ({
                            ...prev,
                            [role.value]: e.target.value,
                          }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Rate"
                        className="h-7 w-20 rounded border border-border bg-background px-2 text-right text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-10 gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-10 flex-1 gap-2 bg-primary text-white hover:bg-primary-hover"
        >
          {saving ? "Saving..." : (
            <>
              Next
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
