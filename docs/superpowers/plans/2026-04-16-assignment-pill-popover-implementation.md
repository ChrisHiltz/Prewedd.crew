# Assignment Pill Popover — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shooter pills on kanban cards and in the CouplePanel staffing section clickable — opening a popover that lets an admin change the shooter's role, resolve conflicts (swap / remove other / add_to), remove the shooter from the wedding, or navigate to the ShooterPanel. Email notifications are prompted after role changes (with correct handling of partial failures, rate limiting, and no-user-account cases).

**Architecture:**
- New React component `AssignmentPillPopover` built on `@radix-ui/react-popover` via shadcn/ui. State machine with states `menu → conflict → saving → notify | flash | closed`. Talks to already-shipped PATCH/DELETE `/api/assign` and POST `/api/assignment-notify` endpoints.
- Cross-surface refresh: parent page owns `refreshAllAssignments()` that fans out to kanban + grid + couple-panel refetchers. Every popover receives this callback as `onAssignmentsChanged`.
- New toast library: `sonner` (shadcn canonical) — installed in this plan because the project has none today.

**Tech Stack:** Next.js 16 App Router, React 19 Client Components, TypeScript strict, `@radix-ui/react-popover` (via shadcn), `sonner` (toasts), Tailwind, Supabase (data refetch via existing queries). No new backend.

**Spec:** `docs/superpowers/specs/2026-04-16-assignment-pill-popover-design.md`

**Deployment posture:** Every meaningful commit goes to Vercel production (`git push origin master`). No local dev runs — Chris tests on https://prewedd-crew.vercel.app. Each test gate is executed against the live deploy after the commit.

**Testing posture:** No unit tests for the popover component. The RPC behavior (Step 6) is already covered by `scripts/smoke-step6.mjs` (19/19 passing); the notify endpoint (Step 7) by `scripts/smoke-step7.mjs` (13/13 passing). The popover is pure client-side state over those surfaces — its correctness is validated by the manual browser test gates at the end of each chunk. A thin new smoke script (`scripts/smoke-step9.mjs`) extends HTTP coverage for the combined PATCH→notify flow paths the popover actually walks.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/components/ui/popover.tsx` | shadcn wrapper around `@radix-ui/react-popover`. Default `PopoverContent` z-index raised to `z-[70]` per spec. |
| `src/components/ui/sonner.tsx` | shadcn-generated `<Toaster/>` wrapper around `sonner`. |
| `src/components/admin/AssignmentPillPopover.tsx` | The popover component itself. Owns the state machine, fetch calls, notify prompt, and toast emission. |
| `scripts/smoke-step9.mjs` | HTTP smoke test for the PATCH→notify combined flow (server-verifiable parts of Steps 8+9). |

### Modified files

| Path | Change |
|---|---|
| `package.json` | Add `sonner` + `@radix-ui/react-popover` dependencies (via `shadcn add`). |
| `src/app/admin/layout.tsx` | Mount `<Toaster richColors position="bottom-right" />` once. |
| `src/components/admin/WeddingCard.tsx` | Extend `WeddingCardAssignment` with `shooter_roles: string[]` + `shooter_has_user: boolean`. Wrap the existing pill button with `AssignmentPillPopover`, preserving `e.stopPropagation()` so card expand/collapse isn't affected. Accept new `onAssignmentsChanged?: () => void` prop. |
| `src/components/admin/KanbanView.tsx` | Accept new `onAssignmentsChanged?: () => void` prop and thread it through to every `<WeddingCard/>` instance. |
| `src/app/admin/calendar/page.tsx` | Extend the kanban query to include `shooter_profiles.roles` and `shooter_profiles.user_id`. Add `refreshAllAssignments()` function. Pass it to `<KanbanView/>` and `<CouplePanel/>`. |
| `src/components/admin/CouplePanel.tsx` | Refactor the data-load effect into a stable `refetchCouple()` with a monotonic request-id guard. Wrap staffing rows with `AssignmentPillPopover`. Accept new `onAssignmentsChanged?: () => void` prop. |

### Unchanged but referenced

- `src/app/api/assign/route.ts` — PATCH + DELETE already shipped.
- `src/app/api/assignment-notify/route.ts` — already shipped.
- `supabase/migrations/20260409190000_change_assignment_role.sql` — RPC already applied to production.

---

## Chunk 1: Infrastructure (shadcn Popover + sonner Toaster)

**Outcome:** After this chunk, the project has a working `<Toaster/>` mounted in the admin shell and a `Popover` primitive available. No UI change yet — shippable because it's dormant.

---

### Task 1: Install shadcn Popover primitive

**Files:**
- Create: `src/components/ui/popover.tsx`
- Modify: `package.json` (adds `@radix-ui/react-popover`)

- [ ] **Step 1: Run the shadcn installer**

```bash
npx shadcn@latest add popover
```

Expected output: confirms installation, writes `src/components/ui/popover.tsx`, adds `@radix-ui/react-popover` to `package.json`.

If the CLI prompts about overwriting anything — CANCEL and ask. Nothing should be overwritten in this project.

- [ ] **Step 2: Raise the default z-index to `z-[70]`**

Open `src/components/ui/popover.tsx`. Find the default `className` on `PopoverContent` (shadcn ships it with `z-50` or similar). Change it to `z-[70]`.

Rationale: CouplePanel is `z-[55]` and ShooterPanel is `z-[60]`. Default `z-50` would render the popover BEHIND both. This is spec §Z-index.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 2: Install sonner and mount the Toaster

**Files:**
- Create: `src/components/ui/sonner.tsx` (via shadcn CLI)
- Modify: `package.json` (adds `sonner`)
- Modify: `src/app/admin/layout.tsx` (mount `<Toaster/>`)

- [ ] **Step 1: Install sonner via shadcn**

```bash
npx shadcn@latest add sonner
```

Expected: creates `src/components/ui/sonner.tsx` (a thin wrapper around the `Toaster` export) and adds `sonner` to `package.json`.

- [ ] **Step 2: Mount `<Toaster/>` in the admin layout**

Open `src/app/admin/layout.tsx`. Near the end of the `AdminLayout` component's returned JSX, just before the closing `</div>` of the outermost wrapper, add:

```tsx
import { Toaster } from "@/components/ui/sonner";

// ...inside AdminLayout return:
<Toaster richColors closeButton position="bottom-right" />
```

Placement: AFTER `{children}`, INSIDE the layout's root element, so toasts render above page content.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/popover.tsx src/components/ui/sonner.tsx src/app/admin/layout.tsx package.json package-lock.json
git commit -m "feat(ui): add shadcn Popover + sonner Toaster infrastructure

Popover z-index raised to z-[70] so it renders above CouplePanel
(z-55) and ShooterPanel (z-60). Toaster mounted once in the admin
layout at bottom-right with richColors + closeButton.

Dormant until Step 8 wires the AssignmentPillPopover component."
```

- [ ] **Step 5: Deploy to Vercel**

```bash
git push origin master
```

Wait ~60s for Vercel build. Verify the build log shows a green deployment at https://vercel.com/prewedd-crew (or the equivalent URL from `vercel:status`).

- [ ] **Step 6: Smoke test the existing app still works**

Browser: https://prewedd-crew.vercel.app/admin/calendar
Expected:
- Page loads without errors (no "Toaster is undefined" or similar)
- Console shows no new warnings or errors

If anything fails, revert and debug before continuing.

---

## Chunk 2: AssignmentPillPopover component (Step 8)

**Outcome:** A standalone, importable `AssignmentPillPopover` component that takes the trigger as children and performs all mutations + notifications. Not wired to any pill yet — shippable without visual change.

---

### Task 3: Scaffold the popover component file

**Files:**
- Create: `src/components/admin/AssignmentPillPopover.tsx`

- [ ] **Step 1: Create the file with type definitions and skeleton**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

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

  // Reset state whenever the popover closes.
  function handleOpenChange(next: boolean) {
    if (!next) setState({ kind: "menu" });
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="z-[70] w-[260px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 text-sm text-muted-foreground">
          TODO: state={state.kind}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

Why this shape:
- `"use client"` — Popover and all state live in the browser.
- `onClick={(e) => e.stopPropagation()}` on `PopoverContent` stops bubbling into the parent kanban card (which has its own expand/collapse click handler). **See spec §"CRITICAL — event propagation".**
- The state is reset to `"menu"` every time the popover closes so reopening starts fresh.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 4: Implement the menu state (primary view)

**Files:**
- Modify: `src/components/admin/AssignmentPillPopover.tsx`

- [ ] **Step 1: Build the role-label + conflict helpers at the top of the file**

Below the types, add:

```tsx
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

/** Can a swap between `self` (currently holding `selfRole`) and `other` be offered? */
function canSwap(selfRole: string, other: PopoverAssignment): boolean {
  return other.shooter_roles.includes(selfRole);
}
```

- [ ] **Step 2: Replace the placeholder `PopoverContent` body with the menu view**

Replace the `<div className="p-3 text-sm …">TODO…</div>` with a switch on `state.kind`:

```tsx
<PopoverContent
  className="z-[70] w-[260px] p-0"
  align="start"
  onClick={(e) => e.stopPropagation()}
>
  {state.kind === "menu" && <MenuView />}
  {state.kind === "conflict" && <ConflictView state={state} />}
  {state.kind === "saving" && <SavingView />}
  {state.kind === "notify" && <NotifyView state={state} />}
  {state.kind === "flash" && <FlashView />}
  {state.kind === "error" && <ErrorView state={state} />}
</PopoverContent>
```

And add these view components as local (closure-captured) functions INSIDE `AssignmentPillPopover` so they have access to `assignment`, `weddingAssignments`, `setState`, etc.:

```tsx
function MenuView() {
  const candidateRoles = assignment.shooter_roles.filter(
    (r) => r !== assignment.role
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-foreground">
          {assignment.shooter_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {roleLabel(assignment.role)} · on this wedding
        </div>
      </div>

      {/* View profile */}
      <button
        type="button"
        className="px-3 py-2 text-left text-sm text-accent hover:bg-muted"
        onClick={() => {
          setOpen(false);
          onViewProfile(assignment.shooter_id);
        }}
      >
        View profile →
      </button>

      {/* Role list — hidden entirely if shooter holds only one role */}
      {candidateRoles.length > 0 && (
        <>
          <div className="border-t border-border px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                  <span>{roleLabel(role)}</span>
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

function SavingView() {
  return (
    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
      Saving…
    </div>
  );
}

function FlashView() {
  // Auto-close after ~800ms. useEffect (not raw setTimeout during render) so
  // the timer is set up ONCE when flash mounts, and cleaned up if the popover
  // closes sooner for any other reason.
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

function ErrorView({ state }: { state: { kind: "error"; message: string } }) {
  return (
    <div className="px-3 py-3">
      <div className="text-sm text-destructive">{state.message}</div>
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
```

Stubs for `handleRoleClick` and `handleRemoveClick` — implement these in the next tasks. Add stubs now so the file compiles:

```tsx
function handleRoleClick(targetRole: string) {
  // Implemented in Task 5
  console.log("TODO handleRoleClick", targetRole);
}

function handleRemoveClick() {
  // Implemented in Task 7
  console.log("TODO handleRemoveClick");
}

function ConflictView({ state: _s }: { state: { kind: "conflict" } & PopoverState }) {
  return <div className="p-3 text-sm">TODO conflict view</div>;
}

function NotifyView({ state: _s }: { state: { kind: "notify" } & PopoverState }) {
  return <div className="p-3 text-sm">TODO notify view</div>;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `TODO` console.logs are fine).

---

### Task 5: Implement `handleRoleClick` → PATCH flow (non-conflict path)

**Files:**
- Modify: `src/components/admin/AssignmentPillPopover.tsx`

- [ ] **Step 1: Replace the `handleRoleClick` stub with the real function**

```tsx
async function handleRoleClick(targetRole: string) {
  const conflict = findConflict(
    weddingAssignments,
    assignment.id,
    targetRole
  );

  if (conflict) {
    // Client-side conflict — pre-populate conflict state and let the user
    // pick a resolution before we round-trip. The server will also enforce.
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

  // No conflict — PATCH directly.
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
    return handlePatchSuccess(data, body.new_role, body.conflict_action);
  }

  // Error paths — see spec §Error handling
  const errCode = typeof data.error === "string" ? data.error : "";

  if (res.status === 403) {
    toast.error("Session expired. Please reload.");
    handleOpenChange(false);
    return;
  }
  if (res.status === 404) {
    toast.error("This assignment no longer exists.");
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
    // Server found a conflict the client didn't flag — switch to conflict state.
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
```

- [ ] **Step 2: Implement `handlePatchSuccess` (normalization + notify decision)**

Add below `runPatch`:

```tsx
function handlePatchSuccess(
  data: Record<string, unknown>,
  newRole: string,
  conflictAction: "swap" | "remove_other" | "add_to" | undefined
) {
  // Fire the cross-surface refetch IMMEDIATELY on commit, per spec.
  onAssignmentsChanged();

  // noop — no DB write, no prompt. Flash and close.
  if (data.noop === true) {
    setState({ kind: "flash" });
    return;
  }

  // Normalize PATCH action → notify payload per the spec's mapping table.
  const action = typeof data.action === "string" ? data.action : "";

  if (action === "swapped") {
    const otherId =
      typeof data.swapped_with_assignment_id === "string"
        ? data.swapped_with_assignment_id
        : null;
    const other = weddingAssignments.find(
      (a) => a.id === otherId
    );

    // Skip notify entirely if either shooter has no linked user account.
    if (!assignment.shooter_has_user || (other && !other.shooter_has_user)) {
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
  // role_change notify.
  const _ = conflictAction; // conflictAction is informational; action is the source of truth.

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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 6: Implement the conflict view (second screen)

**Files:**
- Modify: `src/components/admin/AssignmentPillPopover.tsx`

- [ ] **Step 1: Replace the `ConflictView` stub with the real component**

```tsx
function ConflictView({
  state,
}: {
  state: Extract<PopoverState, { kind: "conflict" }>;
}) {
  const { targetRole, conflicts } = state;

  return (
    <div className="flex flex-col">
      {/* Same header as the menu */}
      <div className="border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-foreground">
          {assignment.shooter_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {roleLabel(assignment.role)} · on this wedding
        </div>
      </div>

      {/* Back */}
      <button
        type="button"
        className="border-b border-border px-3 py-1.5 text-left text-xs text-accent hover:bg-muted"
        onClick={() => setState({ kind: "menu" })}
      >
        ← back
      </button>

      {conflicts.map((c) => (
        <div key={c.id} className="border-b border-border last:border-b-0">
          {/* Banner */}
          <div className="bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ {c.shooter_name} already has {roleLabel(targetRole)}.
          </div>

          {/* Swap — only if legal */}
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
              <div className="font-medium">🔄 Swap with {c.shooter_name}</div>
              <div className="text-xs text-muted-foreground">
                {c.shooter_name} becomes {roleLabel(assignment.role)},{" "}
                {assignment.shooter_name} becomes {roleLabel(targetRole)}.
              </div>
            </button>
          )}

          {/* Remove other */}
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
            <div className="font-medium">✂️ Remove {c.shooter_name}</div>
            <div className="text-xs text-muted-foreground">
              {c.shooter_name} comes off this wedding.{" "}
              {assignment.shooter_name} takes {roleLabel(targetRole)}.
            </div>
          </button>

          {/* Add to */}
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
              ➕ Add {assignment.shooter_name} anyway
            </div>
            <div className="text-xs text-muted-foreground">
              Both {assignment.shooter_name} and {c.shooter_name} are{" "}
              {roleLabel(targetRole)}.
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
```

Why this shape:
- Each conflict row gets its own sub-group (handles N>1 conflicts per spec §Internal states).
- Swap only renders if `c.can_swap` is true — the server's authoritative flag.
- Button copies template both names from props, avoiding hardcoded "Katie"/"Sarah".

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 7: Implement the notify prompt + `handleNotify`

**Files:**
- Modify: `src/components/admin/AssignmentPillPopover.tsx`

- [ ] **Step 1: Replace the `NotifyView` stub**

```tsx
function NotifyView({
  state,
}: {
  state: Extract<PopoverState, { kind: "notify" }>;
}) {
  const { newRole, notifyAction, affectedShooterName } = state;

  const prompt =
    notifyAction === "swapped" && affectedShooterName
      ? `Notify ${firstName(assignment.shooter_name)} and ${firstName(affectedShooterName)} by email?`
      : `Notify ${firstName(assignment.shooter_name)} by email?`;

  return (
    <div className="flex flex-col">
      {/* Header shows NEW role (stable across refetches — newRole is captured in state) */}
      <div className="border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-foreground">
          {assignment.shooter_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {roleLabel(newRole)} · on this wedding
        </div>
      </div>

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
          onClick={() => handleNotifyYes(state)}
        >
          Yes, notify
        </button>
      </div>
    </div>
  );
}

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}
```

- [ ] **Step 2: Implement `handleNotifyYes`**

Add near `runPatch`:

```tsx
async function handleNotifyYes(
  state: Extract<PopoverState, { kind: "notify" }>
) {
  // Close the popover immediately — the notify POST fires in the background,
  // and toasts handle all outcomes.
  handleOpenChange(false);

  const body: Record<string, unknown> = {
    assignment_id: assignment.id,
    action: state.notifyAction,
  };
  if (state.notifyAction === "swapped" && state.affectedIds?.length) {
    body.affected_ids = state.affectedIds;
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

  // Defensive: check `failed > 0` on ANY non-429, non-4xx-validation response.
  // Today the route returns 500 when sent===0 and 200 otherwise, but the spec
  // requires us to branch on the `failed` field regardless of status so a
  // future route change (e.g. always-200-with-failed-count) is safe.
  const failed = typeof data.failed === "number" ? data.failed : 0;
  const failedRecipients = Array.isArray(data.failed_recipients)
    ? (data.failed_recipients as string[])
    : [];

  if (res.status >= 500) {
    // All-failed path — the route returns 500 here today.
    toast.warning("Role updated, but email notification failed.");
    return;
  }

  if (failed > 0 && failedRecipients.length > 0) {
    // Partial — at least one send succeeded, at least one failed.
    toast.warning(
      `Role updated. One email didn't send — please follow up with ${failedRecipients[0]}.`
    );
    return;
  }

  if (failed > 0) {
    // Partial without a named recipient (shouldn't happen today, but covered).
    toast.warning("Role updated, but email notification partially failed.");
    return;
  }

  // Full success — no toast needed, the state change itself is confirmation.
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 8: Implement `handleRemoveClick` → DELETE flow

**Files:**
- Modify: `src/components/admin/AssignmentPillPopover.tsx`

- [ ] **Step 1: Replace the `handleRemoveClick` stub**

```tsx
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

  setState({
    kind: "error",
    message: "Could not remove. Try again?",
  });
}
```

Why this shape: no notify call, no confirmation modal, per spec §Remove flow. `onAssignmentsChanged()` fires BEFORE closing so the refetch starts while the popover animates away.

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/components/admin/AssignmentPillPopover.tsx
```

Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AssignmentPillPopover.tsx
git commit -m "feat(admin): add AssignmentPillPopover component

Standalone popover that takes a trigger as children and handles:
• role changes (PATCH /api/assign) with client-side conflict detection
• conflict resolution (swap / remove_other / add_to) with second-screen UI
• notify prompt after success, with partial-failure + rate-limit + no-user
  account handling
• remove from wedding (DELETE /api/assign)

State machine: menu → conflict → saving → notify | flash | error | closed.
onAssignmentsChanged fires on mutation commit BEFORE the notify prompt
renders, so parent refetches start immediately.

Not yet wired to any pill — integration lands in the next commit."
```

- [ ] **Step 4: Deploy**

```bash
git push origin master
```

Wait for Vercel build. No UI change yet — just verify no build errors. The popover is dead code at this point; tree-shaking keeps it out of the bundle until imported.

---

## Chunk 3: Wire popover to kanban (Step 9a)

**Outcome:** Clicking a shooter pill on any kanban card opens the popover. Changes reflect in the card immediately. Smoke test covers the HTTP layer.

---

### Task 9: Extend the kanban query + `WeddingCardAssignment` type

**Files:**
- Modify: `src/components/admin/WeddingCard.tsx`
- Modify: `src/app/admin/calendar/page.tsx`

- [ ] **Step 1: Read the current kanban query to confirm shape**

Open `src/app/admin/calendar/page.tsx`. Find the function that loads `kanbanWeddings` (look for `.from("weddings").select(...)` with a nested `assignments(...)` subselect).

Note the exact `select()` expression. You'll modify the nested `shooter_profiles(...)` part.

- [ ] **Step 2: Extend the kanban query**

Change the nested `shooter_profiles(...)` expression inside the kanban assignments subselect to:

```
shooter_profiles(id, name, headshot_url, user_id, roles)
```

If `headshot_url` is already in the select, preserve it. The new additions are `user_id` and `roles`.

- [ ] **Step 3: Update the kanban mapping to populate `shooter_roles` + `shooter_has_user`**

In the same file, find where the raw Supabase response is mapped into `WeddingCardData`. Each assignment's mapped shape needs two new fields:

```ts
{
  id: a.id,
  role: a.role,
  shooter_id: profile.id,
  shooter_name: profile.name,
  shooter_roles: (profile.roles as string[]) ?? [],
  shooter_has_user: profile.user_id !== null,
  // ...existing fields
}
```

- [ ] **Step 4: Extend the `WeddingCardAssignment` interface**

Open `src/components/admin/WeddingCard.tsx`. Find `interface WeddingCardAssignment`. Add:

```ts
shooter_roles: string[];
shooter_has_user: boolean;
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If there are errors about missing fields, you haven't mapped something correctly — fix before proceeding.

---

### Task 10: Wrap the kanban pill with the popover

**Files:**
- Modify: `src/components/admin/WeddingCard.tsx`
- Modify: `src/app/admin/calendar/page.tsx`

- [ ] **Step 1: Import `AssignmentPillPopover` in `WeddingCard.tsx` and thread a new `onAssignmentsChanged` prop**

Add to the top:

```tsx
import { AssignmentPillPopover } from "./AssignmentPillPopover";
```

Extend the `WeddingCardProps` interface:

```ts
interface WeddingCardProps {
  // ...existing
  onAssignmentsChanged?: () => void;
}
```

- [ ] **Step 2: Replace the pill button with the popover wrapper**

Find the existing pill rendering (the `<button>` with `onClick={(e) => { e.stopPropagation(); onShooterClick?.(a.shooter_id); }}`). Replace it with:

```tsx
<AssignmentPillPopover
  key={a.id}
  assignment={{
    id: a.id,
    role: a.role,
    shooter_id: a.shooter_id,
    shooter_name: a.shooter_name,
    shooter_roles: a.shooter_roles,
    shooter_has_user: a.shooter_has_user,
  }}
  weddingAssignments={wedding.assignments.map((x) => ({
    id: x.id,
    role: x.role,
    shooter_id: x.shooter_id,
    shooter_name: x.shooter_name,
    shooter_roles: x.shooter_roles,
    shooter_has_user: x.shooter_has_user,
  }))}
  onViewProfile={(shooterId) => onShooterClick?.(shooterId)}
  onAssignmentsChanged={() => onAssignmentsChanged?.()}
>
  <button
    type="button"
    onClick={(e) => e.stopPropagation()}
    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 hover:border-primary hover:bg-primary/5 transition-colors"
  >
    <RoleIcon role={a.role} size="xs" />
    <span className="text-[9px] font-medium text-foreground">
      {a.shooter_name.split(" ")[0]}
    </span>
  </button>
</AssignmentPillPopover>
```

**Why the button's onClick keeps `e.stopPropagation()`:** spec §"CRITICAL — event propagation". Radix's `PopoverTrigger asChild` attaches its own onClick for open toggling; we wrap the button's onClick so our stopPropagation still runs. The card-level expand/collapse click handler on the kanban card must not fire when a pill is clicked.

- [ ] **Step 3: Wire `refreshAllAssignments` in the page**

Open `src/app/admin/calendar/page.tsx`. First, check whether `loadKanbanData`
and `loadGridData` are declared as plain functions (inside the component) or
as `useCallback`-wrapped functions:

- If they are **plain functions** declared inside the component body (the
  most common pattern), they get a new reference every render. Wrapping
  `refreshAllAssignments` in `useCallback` with `[view]` alone will trigger
  the `react-hooks/exhaustive-deps` ESLint rule.
- If they are **already `useCallback`s**, add them to the deps.

**Simplest safe approach: do NOT wrap `refreshAllAssignments` in `useCallback`
at all.** It's called once per mutation, not in a hot path. The performance
cost of a fresh reference each render is zero. Add:

```tsx
function refreshAllAssignments() {
  loadKanbanData();
  if (view === "grid") loadGridData();
}
```

If the eslint rule later flags this as a hook-dependency issue somewhere
downstream, wrap then, with the full deps list explicitly.

(If you DO choose `useCallback`, you must add `useCallback` to the react
import AND include `loadKanbanData`, `loadGridData`, and `view` in the
deps array. Missing any will fail `eslint --max-warnings 0` if the project
enforces it.)

Then pass `refreshAllAssignments` to the kanban view's `<WeddingCard>` instances. This requires three changes in `src/components/admin/KanbanView.tsx`:

1. Extend `KanbanViewProps` to accept `onAssignmentsChanged?: () => void`.
2. Destructure the new prop in the component signature.
3. Pass it to every `<WeddingCard/>` instance.

```tsx
// KanbanView.tsx — prop + destructure + pass-through
interface KanbanViewProps {
  // ...existing
  onAssignmentsChanged?: () => void;
}

export function KanbanView({
  // ...existing,
  onAssignmentsChanged,
}: KanbanViewProps) {
  // ...
  return (
    // ...
    <WeddingCard
      // ...existing props
      onAssignmentsChanged={onAssignmentsChanged}
    />
    // ...
  );
}
```

Then in the page:

```tsx
<KanbanView
  weddings={kanbanWeddings}
  onShooterClick={openShooterPanel}
  onCoupleClick={openCouplePanel}
  onAssignmentsChanged={refreshAllAssignments}
  // ...other props
/>
```

- [ ] **Step 4: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/components/admin/WeddingCard.tsx src/app/admin/calendar/page.tsx
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/WeddingCard.tsx src/app/admin/calendar/page.tsx
git commit -m "feat(admin): wire AssignmentPillPopover to kanban cards

• Extend kanban query with shooter_profiles.roles and user_id.
• Add shooter_roles + shooter_has_user to WeddingCardAssignment.
• Wrap each kanban pill with AssignmentPillPopover, preserving the
  existing e.stopPropagation() that prevents card expand/collapse.
• Add refreshAllAssignments() in the page that fans out to kanban +
  grid refetchers; thread it through KanbanView → WeddingCard →
  popover's onAssignmentsChanged prop."
```

- [ ] **Step 6: Deploy**

```bash
git push origin master
```

Wait ~90s for Vercel build.

---

### Task 11: Write + run the Step 9 smoke test

**Files:**
- Create: `scripts/smoke-step9.mjs`

- [ ] **Step 1: Scaffold the script (extending the Step 6/7 pattern)**

```js
#!/usr/bin/env node
// scripts/smoke-step9.mjs
//
// End-to-end HTTP smoke for the combined PATCH → notify flow the popover
// walks. Step 6 covered PATCH/DELETE in isolation; Step 7 covered notify in
// isolation; this covers the two-call sequence, including the partial-
// failure path that only surfaces when notify is called after a real PATCH.
//
// Usage:
//   1. .test-auth must contain a valid admin session cookie (see Step 6).
//   2. Run: node scripts/smoke-step9.mjs

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const BASE = "https://prewedd-crew.vercel.app";
const PROJECT_REF = "oljrnmgiaypdysmoaovo";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

const cookiePath = resolve(".test-auth");
if (!existsSync(cookiePath)) {
  console.error("✗ .test-auth file not found");
  process.exit(2);
}
const cookieValue = readFileSync(cookiePath, "utf8").trim();
const cookieHeader = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;

function runSql(sql) {
  const tmpFile = resolve(tmpdir(), `smoke9-sql-${randomUUID()}.sql`);
  writeFileSync(tmpFile, sql, "utf8");
  try {
    const out = execSync(`npx supabase db query --linked < "${tmpFile}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    return JSON.parse(out.slice(out.indexOf("{")));
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function call(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

const results = [];
let passed = 0, failed = 0;

function assert(name, actual, predicate) {
  const ok =
    typeof predicate === "function"
      ? predicate(actual)
      : JSON.stringify(actual) === JSON.stringify(predicate);
  results.push({ name, ok, actual });
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name} — got ${JSON.stringify(actual)}`); }
}

async function main() {
  console.log("\n🧪 Step 9 smoke — combined PATCH → notify flow\n");

  // ── Find a safe fixture: a real assignment we can round-trip role changes on
  const fixtures = runSql(`
    SELECT a.id AS assignment_id, a.role AS current_role, sp.roles,
           sp.user_id IS NOT NULL AS has_user
    FROM assignments a
    JOIN shooter_profiles sp ON sp.id = a.shooter_id
    WHERE sp.user_id IS NOT NULL
      AND cardinality(sp.roles) >= 2
    LIMIT 1;
  `);
  if (!fixtures.rows.length) {
    console.error("✗ no suitable fixture — need assignment where shooter has user_id AND ≥2 roles");
    process.exit(2);
  }
  const fix = fixtures.rows[0];
  const otherRole = fix.roles.find((r) => r !== fix.current_role);
  console.log(`  fixture: assignment=${fix.assignment_id}, ${fix.current_role} → ${otherRole}`);

  // Phase 1: PATCH → 200, then POST notify → 200
  console.log("\nPhase 1: happy path (PATCH updated → notify role_change)");
  const patch1 = await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: otherRole,
  });
  assert("PATCH updated → 200 action=updated",
    patch1,
    (r) => r.status === 200 && r.body?.action === "updated");

  const notify1 = await call("/api/assignment-notify", "POST", {
    assignment_id: fix.assignment_id,
    action: "role_change",
  });
  assert("POST notify role_change → 200 sent>=1",
    notify1,
    (r) => r.status === 200 && r.body?.ok === true && r.body?.sent >= 1);

  // Revert the role change so the test is idempotent
  await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: fix.current_role,
  });

  // Phase 2: noop — switch to the role the shooter already has
  console.log("\nPhase 2: noop (PATCH to current role)");
  const patch2 = await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: fix.current_role,
  });
  assert("PATCH to current role → 200 noop=true",
    patch2,
    (r) => r.status === 200 && r.body?.noop === true);

  // Phase 3: invalid_role
  console.log("\nPhase 3: invalid_role");
  const patch3 = await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: "definitely_not_a_role",
  });
  assert("PATCH with bogus role → 400 invalid_role",
    patch3,
    (r) => r.status === 400 && r.body?.error === "invalid_role");

  // Phase 4: not_found
  console.log("\nPhase 4: not_found");
  const patch4 = await call("/api/assign", "PATCH", {
    assignment_id: "00000000-0000-0000-0000-000000000000",
    new_role: otherRole,
  });
  assert("PATCH on nonexistent assignment → 404 not_found",
    patch4,
    (r) => r.status === 404 && r.body?.error === "not_found");

  // ── Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Passed: ${passed} / Failed: ${failed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  if (failed > 0) {
    for (const r of results.filter(r => !r.ok)) console.log(`  • ${r.name}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
```

- [ ] **Step 2: Run the smoke test**

```bash
node scripts/smoke-step9.mjs
```

Expected: all assertions pass. Each run sends one real email to the fixture shooter (their own existing role change gets confirmed). The fixture-finding SQL picks a shooter with `user_id IS NOT NULL`, so the notify POST will always reach Resend.

If anything fails, fix the server-side route or the smoke script, then re-run. Do NOT proceed until green.

- [ ] **Step 3: Commit the smoke script**

```bash
git add scripts/smoke-step9.mjs
git commit -m "test(smoke): add smoke-step9.mjs for combined PATCH → notify flow

Covers the two-call sequence the popover walks, plus invalid_role +
not_found + noop branches that smoke-step6 didn't exercise."
```

- [ ] **Step 4: Manual browser test gate — kanban**

Browser: https://prewedd-crew.vercel.app/admin/calendar

Run each test. Check off only after visually confirming:

- [ ] Click a shooter pill on a kanban card → popover opens with "View profile" + role list + "Remove from wedding"
- [ ] Click "View profile" → ShooterPanel opens; popover closes cleanly; no z-index issues
- [ ] Click a non-conflicted role → popover shows "Saving…" then notify prompt; click "Yes, notify" → toast or silent success; card updates to show the new role
- [ ] Click a conflicted role → conflict view appears with Swap/Remove/Add options
- [ ] "Swap" button only appears when the other shooter holds the original role
- [ ] Click Swap → both pills on the card swap roles correctly
- [ ] Click "Remove from wedding" → pill disappears from the card immediately; no notify prompt appears
- [ ] Clicking a pill does NOT expand/collapse the card (stopPropagation preserved)
- [ ] Click outside the popover → closes cleanly; state resets (reopen shows menu, not conflict)
- [ ] Escape key closes the popover

If any fail, fix and redeploy before Chunk 4.

---

## Chunk 4: Wire popover to CouplePanel (Step 9b)

**Outcome:** Shooter rows in the CouplePanel staffing section open the same popover. Changes reflect in both the panel and any underlying kanban card immediately.

---

### Task 12: Refactor CouplePanel's data effect to a stable `refetchCouple`

**Files:**
- Modify: `src/components/admin/CouplePanel.tsx`

- [ ] **Step 1: Read the current effect and surrounding state**

Open `src/components/admin/CouplePanel.tsx`. Locate the `useEffect` starting around line 200 that loads the couple + wedding data. Note it uses a local `cancelled = false` closure for stale-response guarding.

- [ ] **Step 2: Replace the effect with a request-id-guarded callback**

Ensure `useCallback` and `useRef` are imported (add them to the existing `react` import if missing):

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
```

**Important:** Preserve the EXACT column list from the current effect (`CouplePanel.tsx:208-216`). Only two changes to the existing select:
1. Extend the nested `shooter_profiles(...)` subselect to add `user_id, roles`.
2. Wrap the logic in `useCallback` with a monotonic `requestIdRef` guard.

**Do NOT invent new columns.** The existing query lists `services, package, hours_of_coverage, add_ons` — use those. Any column not already in the select is wrong.

Replace the effect body:

```tsx
const requestIdRef = useRef(0);

const refetchCouple = useCallback(async () => {
  // Handle coupleId=null — clear state and bail, matching the original effect.
  if (!coupleId) {
    setCouple(null);
    setWedding(null);
    return;
  }
  const myId = ++requestIdRef.current;
  setLoading(true);

  const supabase = createClient();
  const [coupleRes, weddingRes] = await Promise.all([
    supabase
      .from("couples")
      .select("id, names, pronouns, description, energy_profile, best_day_ever, excited_about, nervous_about, notes")
      .eq("id", coupleId)
      .single(),
    supabase.from("weddings").select(`
      id, date, status, services, package, hours_of_coverage, add_ons,
      num_photographers, num_videographers, num_assistants, assistant_roles,
      venue_name, venue_address, ceremony_location, getting_ready_location,
      coordinator_name, coordinator_phone, planner_name, dress_code, meal_plan,
      wrap_time, file_deadline, gear_notes, team_notes,
      timeline_couple_url, timeline_internal_url, moodboard_url, family_checklist_url,
      team_confirmation_status,
      assignments(id, role, status, brief_read, quiz_passed, shooter_profiles(id, name, headshot_url, user_id, roles))
    `).eq("couple_id", coupleId).single(),
  ]);

  // Stale-response guard — if a newer call started, drop this result.
  if (requestIdRef.current !== myId) return;

  if (coupleRes.data) setCouple(coupleRes.data as CoupleData);
  if (weddingRes.data) setWedding(weddingRes.data as unknown as FullWedding);
  setLoading(false);
}, [coupleId]);

useEffect(() => {
  refetchCouple();
}, [refetchCouple]);
```

**Key changes from the original effect:**
- The `shooter_profiles(...)` subselect now includes `user_id, roles` (needed by the popover).
- The `cancelled` closure is replaced by a monotonic `requestIdRef`. If a second `refetchCouple()` call starts before the first completes, the first's `setState` calls are no-ops.
- `coupleId=null` handling is preserved (matches the original behavior at line 201).
- ALL other columns on `weddings` and `couples` are unchanged — copy from `CouplePanel.tsx:207-217` verbatim.

- [ ] **Step 3: Update `FullWedding`'s assignment shape to include the new fields**

Find the `FullWedding` interface (or wherever `assignments` is typed inside it). Add:

```ts
shooter_profiles: {
  id: string;
  name: string;
  headshot_url: string | null;
  user_id: string | null;   // NEW
  roles: string[];          // NEW
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 13: Add `onAssignmentsChanged` prop to CouplePanel + wire popover

**Files:**
- Modify: `src/components/admin/CouplePanel.tsx`
- Modify: `src/app/admin/calendar/page.tsx`

- [ ] **Step 1: Extend `CouplePanelProps`**

Find the `CouplePanelProps` interface. Add:

```ts
onAssignmentsChanged?: () => void;
onShooterClick?: (shooterId: string) => void;  // if not already present
```

- [ ] **Step 2: Wrap staffing-row shooters with `AssignmentPillPopover`**

Find the staffing section that renders assigned shooter rows (around
`CouplePanel.tsx:297`). Each `a.shooter_profiles` can be `null` per the
`WeddingAssignment` type — the existing render uses `a.shooter_profiles?.id`
with fallbacks. The popover can't operate on a null profile, so those
rows must keep the existing non-clickable render.

Build a helper at the top of the staffing section:

```tsx
// Precompute popover-eligible assignments (non-null shooter_profiles only).
// Rows with null profiles render the existing fallback UI — no popover.
const popoverAssignments = wedding.assignments
  .filter((x) => x.shooter_profiles !== null)
  .map((x) => ({
    id: x.id,
    role: x.role,
    shooter_id: x.shooter_profiles!.id,
    shooter_name: x.shooter_profiles!.name,
    shooter_roles: x.shooter_profiles!.roles ?? [],
    shooter_has_user: x.shooter_profiles!.user_id !== null,
  }));
```

Then, inside the staffing map, wrap each row conditionally:

```tsx
import { AssignmentPillPopover } from "./AssignmentPillPopover";

{wedding.assignments.map((a) => {
  // Null shooter_profiles — render the existing fallback, no popover.
  if (!a.shooter_profiles) {
    return (
      <div key={a.id} className="...existing row styles...">
        <span className="text-[11px] text-muted-foreground">Unknown shooter</span>
      </div>
    );
  }

  const sp = a.shooter_profiles;
  return (
    <AssignmentPillPopover
      key={a.id}
      assignment={{
        id: a.id,
        role: a.role,
        shooter_id: sp.id,
        shooter_name: sp.name,
        shooter_roles: sp.roles ?? [],
        shooter_has_user: sp.user_id !== null,
      }}
      weddingAssignments={popoverAssignments}
      onViewProfile={(shooterId) => onShooterClick?.(shooterId)}
      onAssignmentsChanged={() => {
        refetchCouple();
        onAssignmentsChanged?.();
      }}
    >
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/50"
      >
        {/* Preserve the existing shooter row markup — headshot, RoleIcon,
            name, role label, brief_read/quiz_passed dots. Copy from
            CouplePanel.tsx:298-308 verbatim. */}
      </button>
    </AssignmentPillPopover>
  );
})}
```

**CRITICAL — preserve existing row contents.** Copy the markup from
`CouplePanel.tsx:298-308` (headshot, role icon, name with `?? "Unknown"`
fallback, role label, brief_read + quiz_passed dots) into the button
child. Only the outer wrapping changes from `<button>` to
`<AssignmentPillPopover><button>`. Type the TypeScript assertion
`sp` rather than `a.shooter_profiles!` to avoid non-null assertions
scattered through the JSX.

The `onAssignmentsChanged` handler fires BOTH CouplePanel's own
`refetchCouple()` AND the parent's `onAssignmentsChanged` (which fans
out to kanban + grid).

- [ ] **Step 3: Wire the page to pass `refreshAllAssignments` and `openShooterFromCouple` into CouplePanel**

Open `src/app/admin/calendar/page.tsx`. Find where `<CouplePanel coupleId={...} />` is rendered. Extend:

```tsx
<CouplePanel
  coupleId={activeCoupleId}
  onClose={() => setActiveCoupleId(null)}
  onShooterClick={openShooterFromCouple}
  onAssignmentsChanged={refreshAllAssignments}
/>
```

**Important:** `onShooterClick` must be `openShooterFromCouple` (preserves couple context), NOT `openShooterPanel` (closes couple). See spec §Z-index for why.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CouplePanel.tsx src/app/admin/calendar/page.tsx
git commit -m "feat(admin): wire AssignmentPillPopover to CouplePanel staffing

• Refactor CouplePanel's data-load effect into a stable useCallback
  refetchCouple() with a monotonic request-id guard (replaces the old
  cancelled-flag closure).
• Extend CouplePanel's wedding query with shooter_profiles.roles and
  user_id.
• Wrap staffing-section shooter rows with AssignmentPillPopover.
• Couple-panel popover's onAssignmentsChanged fires BOTH refetchCouple()
  AND the parent's callback, so kanban + grid update too.
• onShooterClick wired to openShooterFromCouple (preserves couple
  context when opening ShooterPanel from within CouplePanel)."
```

- [ ] **Step 6: Deploy**

```bash
git push origin master
```

Wait ~90s for Vercel build.

- [ ] **Step 7: Manual browser test gate — CouplePanel**

Browser: https://prewedd-crew.vercel.app/admin/calendar

Open any wedding's CouplePanel (click a card's couple name). Run each test:

- [ ] Staffing section shooter rows are clickable → popover appears
- [ ] "View profile" from popover → ShooterPanel opens WHILE CouplePanel remains open
- [ ] Role change from CouplePanel → staffing section updates immediately (not stale)
- [ ] Role change from CouplePanel → close CouplePanel → underlying kanban card also updated (not stale)
- [ ] Remove from CouplePanel → shooter disappears from staffing section immediately
- [ ] Remove from CouplePanel → close → kanban card also shows pill gone
- [ ] Switch couples (open one panel, close, open another) → no stale data from the previous couple flashes

If any fail, fix and redeploy. If all pass, proceed to the final check.

---

## Chunk 5: Final verification + cleanup

### Task 14: Full regression pass across all Step 8+9 test gates

- [ ] **Step 1: Re-run all three smoke tests**

```bash
node scripts/smoke-step6.mjs
node scripts/smoke-step7.mjs
node scripts/smoke-step9.mjs
```

All three must be green. If any regressed, stop and debug.

- [ ] **Step 2: Run typecheck + lint one more time**

```bash
npx tsc --noEmit
npx eslint src/components/admin/AssignmentPillPopover.tsx src/components/admin/WeddingCard.tsx src/components/admin/CouplePanel.tsx src/app/admin/calendar/page.tsx
```

Expected: both clean.

- [ ] **Step 3: Full manual regression gate**

Browser: https://prewedd-crew.vercel.app/admin/calendar

Re-run the combined test matrix:

- [ ] Kanban pill click → popover opens, all flows (role change / swap / remove) work
- [ ] CouplePanel staffing pill click → same
- [ ] "View profile" works from both kanban and CouplePanel pills, opens ShooterPanel at correct z-index
- [ ] After a role change in CouplePanel, closing the panel shows an up-to-date kanban card
- [ ] After a role change in kanban, opening CouplePanel over the same wedding shows up-to-date staffing
- [ ] Conflict flow — "Swap" option only appears when legal (other shooter holds the old role)
- [ ] Notify prompt appears with correct copy ("Notify Katie" for normal, "Notify Katie and Sarah" for swap)
- [ ] Notify prompt is SKIPPED for shooters with no linked user account (shooter_profiles.user_id IS NULL) — popover flashes "Role updated" and closes
- [ ] Single-role shooter → popover shows no role list, just View profile + Remove
- [ ] Grid view: changes from kanban/CouplePanel popover refresh grid when grid is active
- [ ] Toast appears for expected error paths (simulate by temporarily breaking something if needed — e.g., rename the PATCH endpoint to trigger a 404)

- [ ] **Step 4: Final commit (if any stragglers)**

If the test gate flushed out any small fixes, commit them now with a clear message.

---

## Rollback plan

If this plan ships a regression discovered post-deploy:

1. `git revert <Chunk 3 or 4 commit hash>` — the popover file stays dormant, but the kanban/CouplePanel pills go back to the pre-existing behavior. No migrations to roll back (all DB work was done in Steps 6+7).
2. Redeploy via `git push origin master`.
3. Cookie-auth smoke tests (`smoke-step6.mjs`, `smoke-step7.mjs`) should still pass — nothing in this plan touches the RPC or the notify route.

## Deferrals (out of scope for this plan)

Per the spec's §Deferrals:
- No bulk operations (single-assignment popover only).
- No undo — re-open popover and re-act.
- No animation polish (Radix defaults).
- No grid-view pill wiring in this plan — the refresh contract is in place (grid reacts to `refreshAllAssignments`), but wrapping grid pills with the popover is Step 10 (separate work).
- No keyboard hotkeys beyond Radix's built-in Enter/Escape.

## Follow-up migration task (discovered during spec review)

Production's `shooter_profiles.user_id` is nullable but `supabase/migrations/20260402013300_initial_schema.sql:49` still declares `NOT NULL`. A future migration should `ALTER TABLE public.shooter_profiles ALTER COLUMN user_id DROP NOT NULL;` so a fresh `supabase db reset` matches production state. Out of scope here, not a blocker.
