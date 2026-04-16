"use client";

// AssignmentPillPopover
//
// Popover that opens when an admin clicks a shooter pill on a kanban card
// or in the CouplePanel staffing section. Lets the admin:
//   • open ShooterPanel ("View profile")
//   • change the shooter's role (PATCH /api/assign)
//   • resolve conflicts (swap / remove_other / add_to) on a second screen
//   • remove the shooter from the wedding (DELETE /api/assign)
// After a successful role change (not remove), prompts "Notify by email?"
// and POSTs /api/assignment-notify on "Yes".
//
// See:
//   docs/superpowers/specs/2026-04-16-assignment-pill-popover-design.md
//   docs/superpowers/plans/2026-04-16-assignment-pill-popover-implementation.md
//
// Uses base-ui's Popover (shadcn's current default). Note the API differs
// from Radix: `render` prop instead of `asChild`, and the trigger handles
// its own open-toggle click. We wire controlled open state so the popover
// can close itself on terminal actions (after a success, after View profile).

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { RoleIcon } from "@/components/ui/role-icon";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface PopoverAssignment {
  id: string;
  role: string;
  shooter_id: string;
  shooter_name: string;
  shooter_roles: string[];
  shooter_has_user: boolean;
}

interface ConflictRow {
  id: string;
  role: string;
  shooter_id: string;
  shooter_name: string;
  can_swap: boolean;
}

type PopoverState =
  | { kind: "menu" }
  | { kind: "conflict"; targetRole: string; conflicts: ConflictRow[] }
  | { kind: "saving" }
  | {
      kind: "notify";
      newRole: string;
      notifyAction: "role_change" | "swapped";
      affectedIds?: string[];
      affectedShooterName?: string;
    }
  | { kind: "flash" }
  | { kind: "error"; message: string };

interface AssignmentPillPopoverProps {
  assignment: PopoverAssignment;
  weddingAssignments: PopoverAssignment[];
  onViewProfile: (shooterId: string) => void;
  onAssignmentsChanged: () => void;
  children: React.ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  lead_photo: "Lead Photo",
  second_photo: "2nd Photo",
  lead_video: "Lead Video",
  second_video: "2nd Video",
  assistant: "Assistant",
  bts: "BTS",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

/** Returns the other assignment holding `targetRole` on this wedding, if any. */
function findConflict(
  weddingAssignments: PopoverAssignment[],
  selfId: string,
  targetRole: string
): PopoverAssignment | null {
  return (
    weddingAssignments.find(
      (a) => a.id !== selfId && a.role === targetRole
    ) ?? null
  );
}

/** Can a swap between `self` (currently holding `selfRole`) and `other` be offered client-side? Server's `can_swap` is authoritative when 409 comes back. */
function canSwap(selfRole: string, other: PopoverAssignment): boolean {
  return other.shooter_roles.includes(selfRole);
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function AssignmentPillPopover({
  assignment,
  weddingAssignments,
  onViewProfile,
  onAssignmentsChanged,
  children,
}: AssignmentPillPopoverProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PopoverState>({ kind: "menu" });

  // Reset state whenever the popover closes so reopening shows menu, not
  // a stale conflict/notify screen.
  function handleOpenChange(next: boolean) {
    if (!next) setState({ kind: "menu" });
    setOpen(next);
  }

  // ── Mutation handlers ───────────────────────────────────────────────────

  async function handleRoleClick(targetRole: string) {
    const conflict = findConflict(
      weddingAssignments,
      assignment.id,
      targetRole
    );

    if (conflict) {
      // Client-side conflict — show resolution screen. Server will also
      // validate and may return its own 409 with can_swap = false if data
      // raced.
      setState({
        kind: "conflict",
        targetRole,
        conflicts: [
          {
            id: conflict.id,
            role: conflict.role,
            shooter_id: conflict.shooter_id,
            shooter_name: conflict.shooter_name,
            can_swap: canSwap(assignment.role, conflict),
          },
        ],
      });
      return;
    }

    await runPatch({ new_role: targetRole });
  }

  async function runPatch(body: {
    new_role: string;
    conflict_action?: "swap" | "remove_other" | "add_to";
    conflict_assignment_id?: string;
  }) {
    setState({ kind: "saving" });

    let res: Response;
    try {
      res = await fetch("/api/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignment.id, ...body }),
      });
    } catch {
      setState({ kind: "error", message: "Network error. Try again?" });
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      setState({ kind: "error", message: "Bad response from server." });
      return;
    }

    if (res.status === 200) {
      return handlePatchSuccess(data, body.new_role);
    }

    const errCode = typeof data.error === "string" ? data.error : "";

    if (res.status === 403) {
      toast.error("Session expired. Please reload.");
      handleOpenChange(false);
      return;
    }
    if (res.status === 404) {
      toast.warning("This assignment no longer exists.");
      onAssignmentsChanged();
      handleOpenChange(false);
      return;
    }
    if (res.status === 400 && errCode === "invalid_role") {
      setState({
        kind: "error",
        message: "This role is no longer valid for this shooter.",
      });
      return;
    }
    if (
      res.status === 400 &&
      (errCode === "missing_conflict_assignment_id" ||
        errCode === "conflict_mismatch")
    ) {
      toast.warning("Data was stale — please try again.");
      onAssignmentsChanged();
      handleOpenChange(false);
      return;
    }
    if (res.status === 409 && errCode === "conflict") {
      const conflicts = Array.isArray(data.conflicts)
        ? (data.conflicts as ConflictRow[])
        : [];
      setState({
        kind: "conflict",
        targetRole: body.new_role,
        conflicts,
      });
      return;
    }
    if (
      res.status === 409 &&
      (errCode === "conflict_row_gone" ||
        errCode === "conflict_row_stale" ||
        errCode === "cannot_swap")
    ) {
      toast.warning("The situation changed — please try again.");
      onAssignmentsChanged();
      handleOpenChange(false);
      return;
    }

    // Fallthrough — generic 500 or unexpected shape.
    setState({
      kind: "error",
      message: "Could not save. Try again?",
    });
  }

  function handlePatchSuccess(
    data: Record<string, unknown>,
    newRole: string
  ) {
    // Fire the cross-surface refetch IMMEDIATELY on commit, per spec §Props.
    onAssignmentsChanged();

    // noop — no DB write, no prompt.
    if (data.noop === true) {
      setState({ kind: "flash" });
      return;
    }

    const action = typeof data.action === "string" ? data.action : "";

    if (action === "swapped") {
      const otherId =
        typeof data.swapped_with_assignment_id === "string"
          ? data.swapped_with_assignment_id
          : null;
      const other = weddingAssignments.find((a) => a.id === otherId);

      // Skip notify entirely if either shooter has no linked user account.
      if (
        !assignment.shooter_has_user ||
        (other && !other.shooter_has_user)
      ) {
        setState({ kind: "flash" });
        return;
      }

      setState({
        kind: "notify",
        newRole,
        notifyAction: "swapped",
        affectedIds: otherId ? [otherId] : [],
        affectedShooterName: other?.shooter_name,
      });
      return;
    }

    // Everything else (updated / removed_other / added_to) → single-recipient
    // role_change. Per spec §Notify prompt normalization table.
    if (!assignment.shooter_has_user) {
      setState({ kind: "flash" });
      return;
    }

    setState({
      kind: "notify",
      newRole,
      notifyAction: "role_change",
    });
  }

  async function handleNotifyYes(
    s: Extract<PopoverState, { kind: "notify" }>
  ) {
    // Close immediately — the POST fires in the background, toasts surface
    // outcomes. The mutation already committed.
    handleOpenChange(false);

    const body: Record<string, unknown> = {
      assignment_id: assignment.id,
      action: s.notifyAction,
    };
    if (s.notifyAction === "swapped" && s.affectedIds?.length) {
      body.affected_ids = s.affectedIds;
    }

    let res: Response;
    try {
      res = await fetch("/api/assignment-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      toast.warning("Role updated, but email notification failed (network).");
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      toast.warning("Role updated, but email notification failed.");
      return;
    }

    if (res.status === 429) {
      toast.warning(
        "Role updated. Too many emails this minute — notification skipped."
      );
      return;
    }

    // Defensive partial-failure check — branch on `failed` regardless of
    // status. Today the route returns 500 when sent===0 and 200 otherwise;
    // this code tolerates future contract changes (e.g. always-200).
    const failed = typeof data.failed === "number" ? data.failed : 0;
    const failedRecipients = Array.isArray(data.failed_recipients)
      ? (data.failed_recipients as string[])
      : [];

    if (res.status >= 500) {
      toast.warning("Role updated, but email notification failed.");
      return;
    }

    if (failed > 0 && failedRecipients.length > 0) {
      toast.warning(
        `Role updated. One email didn't send — please follow up with ${failedRecipients[0]}.`
      );
      return;
    }

    if (failed > 0) {
      toast.warning(
        "Role updated, but email notification partially failed."
      );
      return;
    }

    // Full success — no toast. The underlying state change is confirmation.
  }

  async function handleRemoveClick() {
    setState({ kind: "saving" });

    let res: Response;
    try {
      res = await fetch("/api/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignment.id }),
      });
    } catch {
      setState({ kind: "error", message: "Network error. Try again?" });
      return;
    }

    if (res.status === 200) {
      onAssignmentsChanged();
      handleOpenChange(false);
      return;
    }

    if (res.status === 403) {
      toast.error("Session expired. Please reload.");
      handleOpenChange(false);
      return;
    }

    setState({ kind: "error", message: "Could not remove. Try again?" });
  }

  // ── Views ──────────────────────────────────────────────────────────────

  function Header({ roleToShow = assignment.role }: { roleToShow?: string }) {
    return (
      <div className="border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-foreground">
          {assignment.shooter_name}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <RoleIcon role={roleToShow} size="xs" />
          <span>
            {roleLabel(roleToShow)} · on this wedding
          </span>
        </div>
      </div>
    );
  }

  function MenuView() {
    const candidateRoles = assignment.shooter_roles.filter(
      (r) => r !== assignment.role
    );

    return (
      <div className="flex flex-col">
        <Header />

        {/* View profile */}
        <button
          type="button"
          className="border-b border-border px-3 py-2 text-left text-sm font-medium text-accent hover:bg-muted"
          onClick={() => {
            setOpen(false);
            onViewProfile(assignment.shooter_id);
          }}
        >
          View profile →
        </button>

        {/* Role list — hidden entirely if shooter holds only their current role */}
        {candidateRoles.length > 0 && (
          <>
            <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Change role to
            </div>
            <div className="pb-1">
              {candidateRoles.map((role) => {
                const conflict = findConflict(
                  weddingAssignments,
                  assignment.id,
                  role
                );
                return (
                  <button
                    key={role}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => handleRoleClick(role)}
                  >
                    <span className="flex items-center gap-1.5">
                      <RoleIcon role={role} size="xs" />
                      {roleLabel(role)}
                    </span>
                    {conflict && (
                      <span className="text-xs text-amber-600">● conflict</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Remove */}
        <button
          type="button"
          className="border-t border-border px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          onClick={handleRemoveClick}
        >
          Remove from wedding
        </button>
      </div>
    );
  }

  function ConflictView({
    s,
  }: {
    s: Extract<PopoverState, { kind: "conflict" }>;
  }) {
    const { targetRole, conflicts } = s;

    return (
      <div className="flex flex-col">
        <Header />
        <button
          type="button"
          className="border-b border-border px-3 py-1.5 text-left text-xs text-accent hover:bg-muted"
          onClick={() => setState({ kind: "menu" })}
        >
          ← back
        </button>

        {conflicts.map((c) => (
          <div
            key={c.id}
            className="border-b border-border last:border-b-0"
          >
            <div className="bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ {c.shooter_name} already has {roleLabel(targetRole)}.
            </div>

            {c.can_swap && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() =>
                  runPatch({
                    new_role: targetRole,
                    conflict_action: "swap",
                    conflict_assignment_id: c.id,
                  })
                }
              >
                <div className="font-medium">
                  🔄 Swap with {firstName(c.shooter_name)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {firstName(c.shooter_name)} becomes {roleLabel(assignment.role)}, {firstName(assignment.shooter_name)} becomes {roleLabel(targetRole)}.
                </div>
              </button>
            )}

            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() =>
                runPatch({
                  new_role: targetRole,
                  conflict_action: "remove_other",
                  conflict_assignment_id: c.id,
                })
              }
            >
              <div className="font-medium">
                ✂️ Remove {firstName(c.shooter_name)}
              </div>
              <div className="text-xs text-muted-foreground">
                {firstName(c.shooter_name)} comes off this wedding. {firstName(assignment.shooter_name)} takes {roleLabel(targetRole)}.
              </div>
            </button>

            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() =>
                runPatch({
                  new_role: targetRole,
                  conflict_action: "add_to",
                  conflict_assignment_id: c.id,
                })
              }
            >
              <div className="font-medium">
                ➕ Add {firstName(assignment.shooter_name)} anyway
              </div>
              <div className="text-xs text-muted-foreground">
                Both {firstName(assignment.shooter_name)} and {firstName(c.shooter_name)} are {roleLabel(targetRole)}.
              </div>
            </button>
          </div>
        ))}
      </div>
    );
  }

  function SavingView() {
    return (
      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
        Saving…
      </div>
    );
  }

  function NotifyView({
    s,
  }: {
    s: Extract<PopoverState, { kind: "notify" }>;
  }) {
    const { newRole, notifyAction, affectedShooterName } = s;

    const prompt =
      notifyAction === "swapped" && affectedShooterName
        ? `Notify ${firstName(assignment.shooter_name)} and ${firstName(affectedShooterName)} by email?`
        : `Notify ${firstName(assignment.shooter_name)} by email?`;

    return (
      <div className="flex flex-col">
        <Header roleToShow={newRole} />

        <div className="px-3 py-3 text-sm">
          Role updated. {prompt}
        </div>

        <div className="flex gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            className="flex-1 rounded border border-border px-2 py-1.5 text-xs hover:bg-muted"
            onClick={() => handleOpenChange(false)}
          >
            No, thanks
          </button>
          <button
            type="button"
            className="flex-1 rounded bg-accent px-2 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
            onClick={() => handleNotifyYes(s)}
          >
            Yes, notify
          </button>
        </div>
      </div>
    );
  }

  function FlashView() {
    // Auto-close after ~800ms. useEffect (not render-phase setTimeout) so
    // the timer is scheduled once on mount and cleaned up on early close.
    useEffect(() => {
      const t = setTimeout(() => handleOpenChange(false), 800);
      return () => clearTimeout(t);
    }, []);
    return (
      <div className="px-3 py-4 text-center text-sm text-foreground">
        Role updated.
      </div>
    );
  }

  function ErrorView({
    s,
  }: {
    s: Extract<PopoverState, { kind: "error" }>;
  }) {
    return (
      <div className="px-3 py-3">
        <div className="text-sm text-destructive">{s.message}</div>
        <button
          type="button"
          className="mt-2 text-xs text-accent hover:underline"
          onClick={() => setState({ kind: "menu" })}
        >
          ← back
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {/* base-ui Trigger auto-toggles open. We pass the caller's trigger
          element via `render` (base-ui's equivalent of Radix `asChild`).
          Callers MUST provide a single element (typically a <button>) and
          MUST preserve any existing onClick logic (e.g. stopPropagation
          to keep parent click handlers like card-expand from firing). */}
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent
        className="z-[70] w-[260px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {state.kind === "menu" && <MenuView />}
        {state.kind === "conflict" && <ConflictView s={state} />}
        {state.kind === "saving" && <SavingView />}
        {state.kind === "notify" && <NotifyView s={state} />}
        {state.kind === "flash" && <FlashView />}
        {state.kind === "error" && <ErrorView s={state} />}
      </PopoverContent>
    </Popover>
  );
}
