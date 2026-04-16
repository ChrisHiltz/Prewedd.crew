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

**"Yes, notify"** fires `POST /api/assignment-notify` with the appropriate
body (`{ assignment_id, action: "role_change" }` or `{ assignment_id,
action: "swapped", affected_ids: [<other>] }`), then closes.

**"No, thanks"** (or clicking outside) just closes.

**Skip-the-prompt rule.** If the shooter has no linked user account (their
`shooter_profiles.user_id` is null, meaning they're rostered but not yet
invited), the notify prompt is not shown — the popover simply flashes
"Role updated" for ~800ms and closes. Sending email to someone who hasn't
been onboarded would 404 at the API anyway; skipping the prompt avoids a
dead-end button.

This is detected from `shooter_profiles.user_id` which Step 9 also adds
to the kanban query alongside `roles`.

### Notify-failure handling

If `/api/assignment-notify` fails (timeout, 500, rate-limit 429), the
mutation already committed. The popover must still close and the parent
must still refetch so stale data isn't shown. The failure is surfaced as
a non-blocking toast — "Role updated, but email notification failed."
No retry affordance in the UI (admin can manually email).

### Remove flow

Clicking **"Remove from wedding"** calls `DELETE /api/assign?id=<assignment_id>`
directly — no confirmation modal, no notify prompt. The rationale is
documented in Step 7's route: removes at this stage happen either because
the shooter never received the initial assignment email or because they
verbally declined. There is no one to notify.

If the delete fails, the popover stays open and shows the error inline
("Could not remove. Try again?"). If it succeeds, the popover closes and
the parent refetches.

---

## Component structure

**New file:** `src/components/admin/AssignmentPillPopover.tsx`

### Props

```ts
interface AssignmentPillPopoverProps {
  /** The assignment being edited. */
  assignment: {
    id: string;
    role: string;
    shooter_id: string;
    shooter_name: string;
    shooter_roles: string[];        // all roles this shooter holds — from shooter_profiles.roles
    shooter_has_user: boolean;      // derived from shooter_profiles.user_id !== null
  };

  /** All assignments on this wedding, for client-side conflict detection. */
  weddingAssignments: Array<{
    id: string;
    role: string;
    shooter_id: string;
    shooter_name: string;
    shooter_roles: string[];        // needed so the swap-legality check can verify the OTHER shooter holds the old role
  }>;

  /** The anchor element (the clicked pill). Popover positions against this. */
  anchorEl: HTMLElement;

  /** Fired when "View profile" is clicked. Parent is responsible for closing the popover BEFORE opening ShooterPanel (z-index order). */
  onViewProfile: (shooterId: string) => void;

  /** Fired after any successful mutation (role change, swap, remove). Parent uses this to refetch its data. */
  onSuccess: () => void;

  /** Close handler — user dismissed via Escape, outside click, or after a terminal state. */
  onClose: () => void;
}
```

### Internal states

The popover is a small state machine. States:

- `"menu"` — primary view with role options + remove
- `"conflict"` — second-screen resolution view; carries `{ targetRole, conflictAssignmentId }`
- `"notify"` — prompt shown after a successful non-remove mutation; carries `{ newAssignmentId, action, affectedIds }`
- `"saving"` — transitional state during the PATCH / DELETE round-trip; shows a subtle inline spinner but keeps the current screen
- `"flash"` — brief "Role updated" message shown when notify is skipped (no-user-account case); auto-closes after 800ms

State transitions:

```
menu → conflict (click conflicted role)
menu → saving → notify (click non-conflicted role, shooter has email)
menu → saving → flash → closed (click non-conflicted role, no email)
menu → saving → closed (click Remove, success)
conflict → saving → notify (click a resolution option, shooter has email)
conflict → saving → flash → closed (same, no email)
conflict → menu (click back)
notify → closed (click either button)
```

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

Current stack: Sheet `z-50`, CouplePanel `z-55`, ShooterPanel `z-60`.
The popover renders at `z-70` (above every panel). This means:

- Opening from kanban: popover sits above the card and any open panels
- Opening from CouplePanel: popover sits above CouplePanel
- Clicking "View profile": popover must close BEFORE ShooterPanel opens,
  otherwise a popover at `z-70` obscures ShooterPanel at `z-60`

The parent enforces the close-first-then-open order in its `onViewProfile`
handler. The popover itself just calls `onViewProfile(shooterId)` and
lets the parent orchestrate.

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

### CouplePanel staffing — mirror the same wiring

File: `src/components/admin/CouplePanel.tsx`

The staffing section already renders shooter rows; swap those for the
same clickable pill + popover pattern. CouplePanel's existing shooter
query needs the same `roles` and `user_id` fields added.

Open question: CouplePanel may render shooters for *multiple weddings*
(the couple's engagement + wedding). Each pill's popover needs access to
**that wedding's** assignments for conflict detection, not a union of all
couple weddings. The data shape is therefore nested: weddings → assignments.
I'll verify this shape when implementing and adjust.

### CouplePanel refresh — explicit `refetch()` callback

CouplePanel's current effect:

```ts
useEffect(() => {
  if (!coupleId) return;
  // ...fetch couple + weddings + assignments
}, [coupleId]);
```

Extract the fetch body into a named function (e.g., `refetchCouple`).
Pass `refetchCouple` down to each popover via its `onSuccess` prop:

```tsx
<AssignmentPillPopover
  assignment={...}
  weddingAssignments={...}
  anchorEl={...}
  onViewProfile={(id) => { closePopover(); openShooterPanel(id); }}
  onSuccess={refetchCouple}
  onClose={closePopover}
/>
```

The popover doesn't need to know it's inside CouplePanel — same callback
contract as the kanban caller. The kanban's `onSuccess` is just the
kanban's own refetch function.

---

## API surface (reference — no changes needed)

Already shipped in Steps 6–7:

- `PATCH /api/assign` — body: `{ assignment_id, new_role, conflict_action?, conflict_assignment_id? }`
  - 200: `{ ok: true, swap_target_id?: string }`
  - 400: `{ error: "shooter_lacks_role" | "invalid_action" | ... }`
  - 403: `{ error: "Forbidden" }`
  - 409: `{ error: "conflict", conflicts: Array<{ id, role, shooter_id, shooter_name }> }`
- `DELETE /api/assign?id=<uuid>` — 204 on success; 403 / 404 otherwise.
- `POST /api/assignment-notify` — body: `{ assignment_id, action: "role_change" | "swapped", affected_ids?: string[] }`
  - 200: `{ ok: true, sent: number, failed: number }`
  - 429: `{ error: "rate_limited", retry_after_seconds: number }` — UI falls through to "notification failed" toast
  - 500: same toast

The popover consumes exactly these. No new endpoints.

---

## Error handling

| Failure | UI response |
|---|---|
| PATCH 400 `shooter_lacks_role` | Stay on `menu`, show inline red text under the clicked row: "This role is no longer valid for this shooter." |
| PATCH 409 (conflict detected server-side but client didn't flag it) | Swap to `conflict` state using the server's returned conflict list. |
| PATCH 403 | Close popover, toast "Session expired. Please reload." |
| PATCH 500 / network fail | Stay on current screen, inline red "Could not save. Try again." |
| DELETE failure | Same inline red text on the Remove row. |
| Notify endpoint failure (after successful mutation) | Popover closes, refetch fires, toast: "Role updated, but email notification failed." |

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
