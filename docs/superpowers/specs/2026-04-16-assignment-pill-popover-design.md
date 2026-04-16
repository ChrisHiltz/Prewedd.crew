# Assignment Pill Popover — Design Spec

## Scope

The UI half of Stage 2's assignment-management work. Steps 6–7 already
shipped the RPC (`change_assignment_role`), the mutation handlers (`PATCH`
and `DELETE` on `/api/assign`), and the server-built notification endpoint
(`POST /api/assignment-notify`). This spec covers the two remaining steps:

- **Step 8** — the `AssignmentPillPopover` React component (purely client-side, no new backend)
- **Step 9** — wiring that popover into `WeddingCard` (kanban) and `CouplePanel` (staffing section), plus the kanban query change that adds `shooter_profiles.roles` to each assignment

Out of scope: the legacy `/api/notify` raw-HTML call in the brief-publish
flow (deferred to Stage 3), new backend endpoints, batch assignment,
unassigned-shooter flows.

---

## UX model

### Interaction — whole-pill click

Today a shooter pill on a kanban card opens `ShooterPanel`. This spec
repurposes the pill: clicking it now opens the `AssignmentPillPopover`.
`ShooterPanel` access is preserved as the **first item inside the popover**
("View profile →"). The muscle-memory shift is intentional — admins use the
role-management flow far more often than they inspect shooter details, so
the faster path should be the common one.

**Click target:** the entire pill. No split hit zones, no edge icon, no
right-click menu. Keyboard: the pill is a `<button>`; `Enter` / `Space`
opens the popover; `Escape` closes it. The pill's focus ring and hover
style stay as-is so the affordance is unchanged visually.

### Layout — minimal menu

Vertical, single-column dropdown. Approximate content order:

```
┌─ Katie Koutsouradis ─────────────────────┐   ← header
│  📸 Lead Photo · on this wedding         │
├──────────────────────────────────────────┤
│  View profile →                          │   ← navigate out (blue)
├──────────────────────────────────────────┤
│  CHANGE ROLE TO                          │   ← section label
│  📷 2nd Photo                            │   ← alt role, no conflict
│  🎥 Lead Video   ● conflict              │   ← alt role, has conflict
├──────────────────────────────────────────┤
│  🗑 Remove from wedding                   │   ← destructive, red
└──────────────────────────────────────────┘
```

**Candidate roles** = every role in `shooter_profiles.roles` (that's why
Step 9 adds this field to the kanban query) **minus** the shooter's
current role on this assignment. No restriction to "roles the wedding
needs" — admins may legitimately assign a shooter to a role the wedding
didn't originally request (packages evolve). The staffing-status util
handles the "more/fewer roles than needed" math elsewhere.

**Current role** is shown in the header only, never as a clickable item.

**Conflict indicator** (`●`) is a small yellow dot + label on any row
whose role is already held by another shooter on this wedding. Conflict
detection is **client-side only** — the popover reads the wedding's
current assignments (already in the kanban card's props) and cross-checks
the shooter's candidate roles against them. The RPC also validates this
server-side; the client check is just for the UX, not for security.

### Conflict resolution — second screen

If the admin clicks a role that has the conflict dot, the popover's body
swaps in place (header stays) to a dedicated conflict-resolution view:

```
┌─ Katie Koutsouradis ─────────────────────┐
│  📸 Lead Photo · on this wedding         │
├──────────────────────────────────────────┤
│  ← back                                  │
├──────────────────────────────────────────┤
│  ⚠ Sarah already has 2nd Photo.          │
├──────────────────────────────────────────┤
│  🔄 Swap with Sarah                       │   (only if legal)
│     Sarah becomes Lead Photo, Katie      │
│     becomes 2nd Photo.                   │
│  ✂️ Remove Sarah                          │
│     Sarah comes off this wedding. Katie  │
│     takes 2nd Photo.                     │
│  ➕ Add Katie anyway                      │
│     Both Katie and Sarah are 2nd Photo.  │
└──────────────────────────────────────────┘
```

**Swap legality.** The swap option is only rendered if the *other*
shooter currently holds the *current* shooter's role (Sarah has Lead Photo
which Katie has). If Sarah has some third role (say 2nd Photo only, and
Katie has Lead Photo), swap isn't offered — only Remove and Add Katie
show. This matches the RPC's own validation, which would reject a
`swap` action in that case.

**Visual footprint.** The popover width stays the same between primary
and conflict screens. Height grows slightly to fit the three explanatory
lines. No horizontal motion.

**Back navigation.** The "← back" link returns to the primary menu. If
the admin cancels by clicking outside or hitting Escape, the popover
closes entirely (no partial state).

### Notify prompt — in-popover confirmation

On a successful role change (either a direct change with no conflict, or
a resolution from the conflict screen), the popover's body swaps again —
this time to a compact "Notify?" prompt:

```
┌─ Katie Koutsouradis ─────────────────────┐
│  📷 2nd Photo · on this wedding          │   ← header now shows NEW role
├──────────────────────────────────────────┤
│  Role updated. Notify Katie by email?    │
│  [ No, thanks ]  [ Yes, notify ]         │
└──────────────────────────────────────────┘
```

**"Yes, notify"** fires `POST /api/assignment-notify` with the
appropriate body, then closes.

**PATCH action → notify payload mapping (normalization table):**

| PATCH `action` | Notify payload | Why |
|---|---|---|
| `"updated"` (role_change, no conflict) | `{ assignment_id, action: "role_change" }` | Standard path — one recipient. |
| `"swapped"` | `{ assignment_id, action: "swapped", affected_ids: [swapped_with_assignment_id] }` | Both shooters get email. Pull `swapped_with_assignment_id` from the PATCH response body (NOT `swap_target_id` — that name doesn't exist). |
| `"removed_other"` | `{ assignment_id, action: "role_change" }` | The OTHER shooter is gone; notifying them is impossible and the popover wouldn't want to anyway. Treat as a single-recipient role_change for the surviving shooter only. |
| `"added_to"` | `{ assignment_id, action: "role_change" }` | Also single-recipient — the other shooter already had the same role, no change to notify them about. |
| `"noop"` | *(skip entirely)* | No DB write. Popover flashes "No change" briefly, no prompt. |

The notify endpoint only accepts `"role_change"` and `"swapped"`; the
popover normalizes all other success cases to `"role_change"` before
posting.

**Copy for swap resolution:** The prompt copy changes from "Notify Katie
by email?" to "Notify Katie and Sarah by email?" because the notify
endpoint sends to **both** shooters on `action: "swapped"`. The popover
has both names in its props (`assignment.shooter_name` and the conflict
row's `shooter_name`), so template them in.

**"No, thanks"** (or clicking outside) just closes.

**Skip-the-prompt rule.** If the shooter has no linked user account
(`shooter_profiles.user_id IS NULL` — verified in production that this
column was relaxed to nullable in a post-initial-schema migration, and
roster-only shooters like "Katie Koutsouradis" actually have NULL), the
notify prompt is not shown — the popover flashes "Role updated" for ~800ms
and closes. Sending to a shooter with no user row would 404 at the API
(`assignment-notify` returns `assignment_not_found_or_no_email`).

For swap, the prompt is also skipped if EITHER shooter has no linked user
(we don't want to partially notify).

### Notify-failure handling

If `/api/assignment-notify` fails (timeout, 500, rate-limit 429), the
mutation already committed. The popover must still close and the parent
must still refetch so stale data isn't shown. The failure is surfaced as
a non-blocking toast — "Role updated, but email notification failed."
No retry affordance in the UI (admin can manually email).

### Remove flow

Clicking **"Remove from wedding"** calls `DELETE /api/assign` with a
JSON body:

```ts
fetch("/api/assign", {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ assignment_id: assignment.id }),
});
```

The route expects the id in the body, not the query string, and returns
`200 { ok: true }` on success (not 204). No confirmation modal, no notify
prompt. The rationale is documented in Step 7's route: removes at this
stage happen either because the shooter never received the initial
assignment email or because they verbally declined. There is no one to
notify.

If the delete fails, the popover stays open and shows the error inline
("Could not remove. Try again?"). If it succeeds, the popover closes and
the parent refetches.

---

## Toast infrastructure (new)

The error-handling table references toasts in ~8 places. The project
currently has no toast library installed (no `sonner`, `react-hot-toast`,
or `@radix-ui/react-toast` in `package.json`) and no toaster mounted in
`src/app/layout.tsx`.

**Decision: install `sonner`** (shadcn/ui's canonical toast choice, ~3KB
gzipped, imperative API, no provider wrapping needed beyond `<Toaster/>`
in the root layout).

Implementation-plan tasks:
1. `npm install sonner`
2. `npx shadcn@latest add sonner` (adds `src/components/ui/sonner.tsx`)
3. Mount `<Toaster />` once in `src/app/layout.tsx` (or `src/app/admin/layout.tsx` if admin-only)
4. Import `{ toast } from "sonner"` in `AssignmentPillPopover.tsx` and call `toast.error(...)` / `toast.success(...)` / `toast.warning(...)` per the error-handling table

No context provider is needed — sonner uses a global emitter.

---

## Component structure

**New file:** `src/components/admin/AssignmentPillPopover.tsx`

### Props and API surface

The popover follows shadcn/Radix's idiomatic "wrap the trigger" pattern
rather than an external `anchorEl`. The parent composes:

```tsx
<AssignmentPillPopover
  assignment={...}
  weddingAssignments={...}
  onViewProfile={...}
  onAssignmentsChanged={...}
>
  <button className="pill-styles">
    <RoleIcon role={a.role} /> {a.shooter_name.split(" ")[0]}
  </button>
</AssignmentPillPopover>
```

The child becomes the `PopoverTrigger asChild`. Radix handles anchoring,
focus return to the trigger on close, reposition-on-scroll, and focus
trap — no hand-rolled DOM refs, no stale `anchorEl` issues across
re-renders. `onClose` is not needed as a prop: Radix's `Popover`
component owns its open state internally, and we hand it the
`onOpenChange` via `useState` inside the popover component.

```ts
interface AssignmentPillPopoverProps {
  /** The assignment being edited. */
  assignment: {
    id: string;
    role: string;
    shooter_id: string;
    shooter_name: string;
    shooter_roles: string[];        // all roles this shooter holds — from shooter_profiles.roles
    shooter_has_user: boolean;      // shooter_profiles.user_id !== null (verified column IS nullable in prod)
  };

  /** All assignments on this wedding, for client-side conflict detection. */
  weddingAssignments: Array<{
    id: string;
    role: string;
    shooter_id: string;
    shooter_name: string;
    shooter_roles: string[];        // the swap-legality check needs this
    shooter_has_user: boolean;      // required too — for the "skip notify on swap if either shooter has no user" rule
  }>;

  /** Fired when "View profile" is clicked. Parent closes popover (Radix does this automatically on this callback by setting open=false) BEFORE opening ShooterPanel (z-index order). */
  onViewProfile: (shooterId: string) => void;

  /** Fired whenever the popover has mutated data and the parent should refetch. Called on successful mutation (commit, BEFORE notify prompt renders) AND on terminal error paths that committed a change before failing (e.g. stale-data 409s where the popover closes without a notify prompt). Rationale: the kanban card shows stale data for the entire time the admin is deciding "Notify?" if this fires on close — worse than a minor popover flicker. The popover holds its own copy of the new role in state so header copy is stable regardless of refetch timing. */
  onAssignmentsChanged: () => void;

  /** Trigger markup — becomes `PopoverTrigger asChild` content. */
  children: React.ReactNode;
}
```

### Internal states

The popover is a small state machine. States:

- `"menu"` — primary view with role options + remove
- `"conflict"` — second-screen resolution view; carries `{ targetRole, conflicts: ConflictRow[] }` where a `ConflictRow` mirrors the server's 409 response: `{ id, role, shooter_id, shooter_name, can_swap }`. N>1 conflicts is rare but possible (admin previously used `add_to`); the popover renders each conflicting shooter as a sub-group. Swap button is only rendered if `can_swap` is true for that row.
- `"notify"` — prompt shown after a successful non-remove, non-noop mutation that affected at least one shooter who CAN be emailed. Carries `{ newRole, notifyAction: "role_change" | "swapped", affectedIds?: string[], affectedShooterName?: string }`. The popover captures `newRole` into its own state on mutation success (NOT from the prop), so subsequent refetches don't flicker the header. **See the PATCH→notify normalization table above**: `"updated"`, `"removed_other"`, and `"added_to"` all map to `notifyAction: "role_change"` (one recipient); `"swapped"` maps to `notifyAction: "swapped"` (two recipients).
- `"saving"` — transitional state during the PATCH / DELETE round-trip; keeps the current screen and disables action buttons (no spinner overlay; a subtle opacity on the clicked row).
- `"flash"` — brief "Role updated" message (no action buttons) shown when notify is skipped (no-user-account case, or noop); auto-closes after 800ms.

State transitions:

```
menu → conflict (click conflicted role; set conflicts from client detection)
menu → saving → notify (click non-conflicted role, shooter has email, action != noop)
menu → saving → flash → closed (click non-conflicted role, no email, OR action == noop)
menu → saving → closed (click Remove, success)
conflict → saving → notify (click a resolution option, both shooters have email)
conflict → saving → flash → closed (same, at least one shooter has no user)
conflict → menu (click back)
notify → closed (click either button)
```

**If the client thought there was no conflict but the server returned 409 conflict** (stale data between fetch and click), transition `saving → conflict` using the server's `conflicts` array. The popover re-asks the admin.

**If the server returns `conflict_row_gone` or `conflict_row_stale`** (a 409 variant where the conflict row moved out from under us between the client's initial fetch and this PATCH), close the popover entirely, fire `onAssignmentsChanged` (which triggers refetch), and emit a toast: "The situation changed — please try again." No conflict screen.

**Edge case — shooter holds exactly one role.** The candidate-roles list (all roles minus current) is empty. The "CHANGE ROLE TO" section header and list are both hidden. Menu shows just View Profile + Remove.

### Positioning

Use `Popover` from shadcn/ui (`npx shadcn@latest add popover` if not
already installed — check `src/components/ui/`). shadcn's Popover uses
Radix under the hood, which handles:

- Anchoring against `anchorEl`
- Flip / shift when the popover would overflow the viewport
- Click-outside to close (calls `onClose`)
- Escape to close
- Reposition on scroll and resize (this was called out in the plan review
  — Radix handles it automatically)
- Focus trap while open; return focus to anchor on close

If Popover isn't already in the project, this step installs it. The
alternative (hand-rolling a `position: fixed` popover with a one-time
`anchorRect`) was tried in the original plan and correctly flagged as
brittle. Radix is the right call.

### Z-index — popover above, ShooterPanel above popover

Current stack (verified):
- Sheet overlay + content: `z-50`
- CouplePanel: `z-[55]`
- ShooterPanel: `z-[60]`

**shadcn/Radix gotcha:** shadcn's default `PopoverContent` ships with
`z-50` — BELOW both panels. Radix portals the content to `document.body`
so it escapes CouplePanel's stacking context, and competes on the root
stack. If we leave the default, a popover opened inside CouplePanel will
render BEHIND CouplePanel.

**Fix:** Pass `className="z-[70]"` to `PopoverContent` (either on every
usage, or — cleaner — modify `src/components/ui/popover.tsx` to default
to `z-[70]`). The popover now sits above every panel.

- Opening from kanban: popover above the card, no panels in the way
- Opening from CouplePanel: popover (z-70) above CouplePanel (z-55)
- Clicking "View profile": popover closes BEFORE ShooterPanel opens,
  otherwise a popover at z-70 obscures ShooterPanel at z-60

The parent's `onViewProfile` handler orchestrates the close-then-open:

```tsx
onViewProfile={(shooterId) => {
  // The popover has already called its internal setOpen(false) BEFORE
  // invoking this callback (Radix does NOT auto-close on arbitrary button
  // clicks inside PopoverContent — only on outside-click/escape). Parent
  // just opens the panel.
  openShooterPanel(shooterId);       // from kanban
  // OR (from CouplePanel — preserves couple context, see Wiring):
  // openShooterFromCouple(shooterId);
}}
```

### Sizing

Width: `min-w-[240px] max-w-[280px]`. Single column. Height auto-expands
to fit content. No scroll — if a shooter holds 7+ roles, the popover
just gets taller. This is unlikely enough to not worry about.

---

## Wiring (Step 9)

### Kanban query — add `shooter_profiles.roles` and `user_id`

File: `src/app/admin/calendar/page.tsx` — the function that builds
`kanbanWeddings` with its assignments subselect.

Change the select expression so each assignment row carries:

```
shooter_profiles(
  id,
  name,
  user_id,
  roles
)
```

Then map these into the `WeddingCardAssignment` shape.

### `WeddingCardAssignment` — add two fields

File: `src/components/admin/WeddingCard.tsx`

```ts
export interface WeddingCardAssignment extends AssignmentForScheduling {
  id: string;
  shooter_id: string;
  shooter_name: string;
  shooter_roles: string[];        // NEW
  shooter_has_user: boolean;      // NEW — derived from shooter_profiles.user_id != null
}
```

### Pill rendering — wrap existing button with popover trigger

The existing pill `<button>` becomes the `Popover.Trigger`. The popover
body renders the new component. No change to the pill's visual styling.

**CRITICAL — event propagation:** The current pill in
`src/components/admin/WeddingCard.tsx:110` calls `e.stopPropagation()`
inside its `onClick` to prevent the card itself from expanding/collapsing
when a pill is clicked. When the pill becomes a `PopoverTrigger asChild`,
Radix attaches its own onClick. **We must preserve the stopPropagation
behavior** — either:
- On the trigger button element (`<button onClick={(e) => e.stopPropagation()}>…</button>` inside `PopoverTrigger asChild`), OR
- On the outer popover wrapper (`<div onClick={(e) => e.stopPropagation()}><AssignmentPillPopover>…</AssignmentPillPopover></div>`)

Missing this will regress card expansion behavior. The implementation
plan needs an explicit checkpoint for this.

### CouplePanel staffing — mirror the same wiring

File: `src/components/admin/CouplePanel.tsx`

The staffing section already renders shooter rows; swap those for the
same clickable pill + popover pattern. CouplePanel's existing shooter
query needs the same `roles` and `user_id` fields added.

**Data model (resolved):** CouplePanel today fetches exactly ONE wedding
per couple via `.single()` (see `CouplePanel.tsx:217`). The current data
model assumes 1:1 couple-to-wedding. The popover's `weddingAssignments`
prop is therefore `wedding.assignments` — a flat array, no nesting,
identical to the kanban pattern.

If a future change introduces multiple weddings per couple (engagement
shoot + wedding day), the popover contract doesn't change — each pill is
still scoped to its own wedding's assignments. Only CouplePanel's render
layer would need to group by wedding. That's out of scope here.

### CouplePanel refresh — explicit `refetch()` callback

CouplePanel's current effect uses a `let cancelled = false` closure for
stale-response handling. A naive extraction into a named `refetchCouple`
would lose that guard — two concurrent invocations (e.g., coupleId switch
mid-flight while a popover also fires onAssignmentsChanged) could interleave their
setState calls.

**Correct refactor:**

1. Move the fetch body into a `useCallback(refetchCouple, [coupleId])`.
2. Use a monotonic request-id ref (`const requestIdRef = useRef(0)`) to
   guard stale responses: increment on each call, capture the local id,
   and `if (requestIdRef.current !== myId) return` before each setState.
3. Optionally use AbortController via Supabase's `.abortSignal(signal)` —
   cleaner cancellation but more setup. The request-id pattern is
   sufficient here.
4. The `useEffect` on `[coupleId]` simply calls `refetchCouple()`.

### Cross-surface refresh — lifted parent callback

A mutation from any popover (kanban pill, CouplePanel pill, or — once
Grid pill wiring lands — grid pill) can change data that every OTHER
surface is rendering. `DELETE` and `remove_other` remove an assignment
entirely; `swap` and `role_change` change which shooter holds which role.
The kanban, the grid, and any open CouplePanel must all stay in sync.

The page component (`src/app/admin/calendar/page.tsx`) owns every
data-loading function:
- `loadKanbanData()` — refreshes `kanbanWeddings`
- `loadGridData()` — refreshes `gridShooters` / `gridWeddingDates` / `gridAssignments`
- CouplePanel's own `refetchCouple()` — owned by the panel, exposed back up via ref or callback

A single parent-level function `refreshAllAssignments()` calls all three
(grid refetch is a no-op if the grid view isn't mounted). Every popover
is wired to this same function via its `onAssignmentsChanged` prop.
CouplePanel additionally calls its own `refetchCouple()` internally
before propagating up.

```tsx
// page.tsx
const refreshAllAssignments = useCallback(() => {
  loadKanbanData();
  if (view === "grid") loadGridData();
}, [view]);

// Kanban pill (in WeddingCard):
<AssignmentPillPopover
  assignment={...}
  weddingAssignments={...}
  onViewProfile={openShooterPanel}
  onAssignmentsChanged={refreshAllAssignments}
>…</AssignmentPillPopover>

// CouplePanel pill — couple's own refetch happens first, then cascades:
<AssignmentPillPopover
  assignment={...}
  weddingAssignments={...}
  onViewProfile={openShooterFromCouple}  // preserves couple context
  onAssignmentsChanged={() => {
    refetchCouple();
    onAssignmentsChanged?.();  // prop from page.tsx → refreshAllAssignments
  }}
>…</AssignmentPillPopover>
```

CouplePanel accepts a new prop `onAssignmentsChanged?: () => void` and
threads it through. Name match is deliberate: every layer uses the same
callback name so wiring is obvious.

**Grid note:** Grid view already owns its own pill rendering via
`GridView.tsx`. A follow-up step (Step 10, out of scope here) will wire
the popover into grid pills too. The refresh contract is already in
place so no churn is needed then — `refreshAllAssignments` already covers
grid.

The popover doesn't know which surface it's inside — same callback
contract either way.

---

## API surface (reference — no changes needed)

Already shipped in Steps 6–7. Shapes below verified against
`src/app/api/assign/route.ts` and `src/app/api/assignment-notify/route.ts`:

### `PATCH /api/assign`

**Request body:**
```ts
{
  assignment_id: string,
  new_role: string,
  conflict_action?: "swap" | "remove_other" | "add_to",
  conflict_assignment_id?: string,  // required if conflict_action is set
}
```

**Responses** (the route returns the RPC result verbatim on success):
- **200 — role change:** `{ ok: true, action: "updated" }`
- **200 — swap:** `{ ok: true, action: "swapped", swapped_with_assignment_id: string, swapped_with_shooter_id: string }` — note `swapped_with_assignment_id`, NOT `swap_target_id`
- **200 — remove_other:** `{ ok: true, action: "removed_other", removed_assignment_id: string }`
- **200 — add_to:** `{ ok: true, action: "added_to" }`
- **200 — noop:** `{ ok: true, noop: true }` — note shape: NOT `{ action: "noop" }`. The new role already matched current, no DB write occurred, no prompt needed. Branch on `result.noop === true`.
- **400:** `{ error: "invalid_role" | "invalid_action" | "missing_conflict_assignment_id" | "conflict_mismatch" }` — note the role-not-in-shooter's-list error is `invalid_role`, NOT `shooter_lacks_role` (the latter name does not exist in the route)
- **403:** `{ error: "Forbidden" | "forbidden" }` — route.ts:337 uses capital-F; RPC passthrough uses lowercase
- **404:** `{ error: "not_found" }` — assignment id doesn't exist or shooter/wedding missing
- **409 — conflict:** `{ error: "conflict", conflicts: Array<{ id, role, shooter_id, shooter_name, can_swap: boolean }> }`
- **409 — cannot_swap:** `{ error: "cannot_swap", message: string }` — race: client fetched data when swap was legal, but the other shooter's roles changed before the PATCH ran. Treat like conflict_row_stale (close, refetch, "situation changed" toast).
- **409 — raced:** `{ error: "conflict_row_gone" | "conflict_row_stale" }` — conflict row moved between client fetch and click

The popover must branch on `noop` (skip prompt entirely) vs `action`
(decide notify copy and pull `swapped_with_assignment_id` for
`affected_ids[0]`).

The **`can_swap`** boolean on each conflict row is authoritative — the
RPC already computed swap legality (migration line 95). The client's
own legality check is just for rendering the conflict screen before the
server round-trip; if `can_swap` comes back false from the RPC but the
client thought it was legal, defer to the server.

### `DELETE /api/assign`

**Request body** (JSON, NOT query string):
```ts
{ assignment_id: string }
```

**Responses:**
- **200:** `{ ok: true }` (NOT 204)
- **400:** `{ error: "Missing assignment_id" | "Invalid JSON" }`
- **403:** `{ error: "Forbidden" }`
- **500:** `{ error: "<db error message>" }`

### `POST /api/assignment-notify`

**Request body:**
```ts
{
  assignment_id: string,
  action: "role_change" | "swapped",
  affected_ids?: string[],  // required for action: "swapped"; first element is the OTHER assignment's id
}
```

**Responses:**
- **200:** `{ ok: true, sent: number, failed: number, failed_recipients: string[] }` — **IMPORTANT:** the route returns 200 if AT LEAST ONE email was sent, even when some recipients failed. Swap notifies (2 recipients) can silently hide a one-sided failure at this status code. The popover MUST branch on `failed > 0` regardless of HTTP status and treat it as a partial-failure case (different toast than "all emails failed").
- **400:** `{ error: "invalid_action" | "missing_affected_ids" | "invalid_swap_target" | "Missing assignment_id or action" }`
- **403:** `{ error: "Forbidden" }`
- **404:** `{ error: "assignment_not_found_or_no_email" }` — the fallback target for the no-user-account case, though the popover preempts this via the skip rule
- **429:** `{ error: "rate_limited", retry_after_seconds: number }` — UI falls through to "notification failed" toast
- **500:** `{ ok: false, sent: 0, failed: 2, failed_recipients: [...] }` — Resend send(s) all failed

The popover consumes exactly these. No new endpoints.

---

## Error handling

| Failure | UI response |
|---|---|
| PATCH 400 `invalid_role` | Stay on `menu`, show inline red text under the clicked row: "This role is no longer valid for this shooter." |
| PATCH 400 `invalid_action` | Stay on `menu`, show inline red: "Invalid action." (should be unreachable — bug if it fires) |
| PATCH 400 `missing_conflict_assignment_id` / `conflict_mismatch` | Close popover, fire `onAssignmentsChanged` (refetch), toast "Data was stale — please try again." |
| PATCH 404 `not_found` | Close popover, fire `onAssignmentsChanged` (refetch), toast "This assignment no longer exists." |
| PATCH 409 `conflict` (client didn't flag it) | Transition `saving → conflict` using the server's `conflicts` array. |
| PATCH 409 `conflict_row_gone` / `conflict_row_stale` / `cannot_swap` | Close popover, fire `onAssignmentsChanged` (refetch), toast "The situation changed — please try again." |
| PATCH 403 (`Forbidden` or `forbidden`) | Close popover, toast "Session expired. Please reload." |
| PATCH 500 / network fail | Stay on current screen, inline red "Could not save. Try again." |
| DELETE failure (500) | Same inline red text on the Remove row. |
| DELETE 403 | Close popover, toast "Session expired. Please reload." |
| Notify 200 with `failed === 0` | Popover closes, refetch fires, no toast (success path). |
| Notify 200 with `failed > 0` (partial) | Popover closes, refetch fires, toast: "Role updated. One email didn't send — please follow up with [failed_recipients[0]]." |
| Notify 429 rate-limited | Popover closes, refetch fires, toast: "Role updated. Too many emails this minute — notification skipped." |
| Notify 500 (all sends failed) | Popover closes, refetch fires, toast: "Role updated, but email notification failed." |

No retries from the popover. Admins can re-open and re-act.

---

## Testing

Browser-based manual gate (Step 9's test checklist already exists in the
plan file). No new automated tests are added for this step — the RPC
behavior is already covered by `scripts/smoke-step6.mjs`, and the notify
behavior by `scripts/smoke-step7.mjs`. The popover is pure client-side
state management over those two surfaces; its correctness is best
validated by clicking through the actual flows.

Manual tests to run after deploy:

1. Click a shooter pill on a kanban card — popover opens with View
   profile + role list + Remove
2. Click "View profile" — popover closes, ShooterPanel opens; z-index correct
3. Click a non-conflicted role — saving → notify prompt → Yes sends email
4. Click a conflicted role — swap to conflict screen; back button returns
5. On conflict screen: Swap is only shown if swap is legal
6. Remove — row disappears from the kanban card without a page refresh
7. Repeat all of the above from CouplePanel's staffing section
8. Change a role from CouplePanel — staffing section updates without stale data
9. Katie (no user account): role change should flash "Role updated"
   instead of showing the notify prompt
10. Force a notify failure (temporarily set `RESEND_API_KEY` bogus in
    Vercel preview) — toast appears, panel still refetches

---

## Deferrals

These could go in this step but aren't:

- **No bulk operations.** Changing multiple shooters at once is a separate
  workflow. The popover is single-assignment only.
- **No undo.** If the admin mis-swaps, they re-open the popover and swap
  back. Cheap enough.
- **No keyboard shortcut for the notify prompt.** Enter/Escape are wired
  (via Radix), but no hotkey for "Yes notify" — arrow-keys through the
  menu items is sufficient.
- **No animation polish.** State transitions (menu ↔ conflict ↔ notify)
  are instant swaps. Fade-in on open is the default shadcn Popover
  behavior; keep it.

---

## Adversarial review checklist

Things the spec reviewer should verify:

- [ ] Client-side conflict detection matches server-side truth (stale
      data between fetch and click could lie — RPC-side 409 catches this)
- [ ] Swap-legality check runs on BOTH shooters (current holds old role,
      other holds new role) — Step 6 RPC does this; spec §"Swap legality"
      calls it out
- [ ] Popover close-before-open for View profile is the parent's
      responsibility, not the popover's — no hidden coupling
- [ ] Z-index order holds: popover above panels, except when opening a
      panel from the popover (parent closes popover first)
- [ ] CouplePanel refetch is wired through a real callback, not a
      "counter bump" implicit dependency
- [ ] Notify-failure UX is explicit: mutation already committed, close +
      refetch + toast; no retry loop
- [ ] No-user-account path skips the notify prompt entirely (spec §"Skip
      -the-prompt rule") — this is a UX decision, not a bug
- [ ] Remove has no notify prompt (matches Step 7 scope note — no
      `"removed"` action at `/api/assignment-notify`)
- [ ] Radix Popover handles reposition-on-scroll (plan-review finding #5
      about drifting popovers — Radix handles automatically; spec relies
      on this and says so)
- [ ] Shooter holding duplicate roles: the RPC allows `add_to` by design;
      conflict screen exposes it as "Add Katie anyway"
