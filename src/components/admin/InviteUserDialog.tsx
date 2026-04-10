"use client";

import { useState } from "react";
import { UserPlus, Send, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Role = "shooter" | "admin";

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("shooter");
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setEmail("");
    setRole("shooter");
    setError("");
    setSuccessMsg("");
    setWarningMsg("");
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json().catch(() => ({})) as { error?: string; emailSent?: boolean; warning?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSending(false);
        return;
      }

      const roleLabel = role === "admin" ? "Admin" : "Shooter";
      if (data.emailSent === false) {
        setWarningMsg(data.warning ?? `Invite created for ${email.trim()} as ${roleLabel}, but email failed to send.`);
      } else {
        setSuccessMsg(`Invite sent to ${email.trim()} as ${roleLabel}`);
      }
      setSending(false);

      setTimeout(() => {
        reset();
      }, 5000);
    } catch {
      setError("Network error. Please try again.");
      setSending(false);
    }
  }

  if (successMsg) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-success">
        <Check className="size-3.5" />
        {successMsg}
      </div>
    );
  }

  if (warningMsg) {
    return (
      <div className="flex items-start gap-1.5 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning-text max-w-sm">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{warningMsg}</span>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 bg-primary text-white hover:bg-primary-hover"
      >
        <UserPlus className="size-3.5" />
        Invite User
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
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
          onClick={reset}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Role selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Role:</span>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
            role === "shooter"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          )}
        >
          <input
            type="radio"
            name="invite-role"
            value="shooter"
            checked={role === "shooter"}
            onChange={() => setRole("shooter")}
            className="sr-only"
          />
          Shooter
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
            role === "admin"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          )}
        >
          <input
            type="radio"
            name="invite-role"
            value="admin"
            checked={role === "admin"}
            onChange={() => setRole("admin")}
            className="sr-only"
          />
          Admin
        </label>
      </div>

      {error && <p className="text-[10px] text-error">{error}</p>}
    </form>
  );
}
