---
name: build-next
description: Build the next step of the PreWedd Crew MVP. Reads current progress from docs/BUILD_STATE.md, executes the next build step, runs the test, and updates state. Use this to drive the entire build with minimal manual intervention.
argument-hint: "[step number to jump to, or blank for next]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Build Next Step

You are building the PreWedd Crew MVP — an internal team platform for a wedding photography studio. 

ultrathink

## Context Loading

Before doing anything:
1. Read `CLAUDE.md` for project conventions and architecture
2. Read `docs/PRD.md` for feature specifications
3. Read `docs/DATABASE.md` for the schema
4. Read `docs/BUILD_STATE.md` to determine the current step number
5. If `$ARGUMENTS` contains a number, jump to that step instead of the next one

## Current Build State

!`cat docs/BUILD_STATE.md 2>/dev/null || echo "step: 0"`

## Build Steps

Execute the step matching the current state. After completing the step, run the matching test. If the test passes, update `docs/BUILD_STATE.md` to the next step number and report success. If the test fails, fix the issue and retest before advancing.

### Step 1: Project Initialization
Initialize a Next.js 16 project using `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"` (use current directory). This will auto-generate AGENTS.md. Install `@supabase/supabase-js`, `@supabase/ssr`. Run `npx shadcn@latest init` with defaults. Set up Tailwind config with brand colors from CLAUDE.md (navy #1B3A5C, accent #2E75B6, warm #C9956B, green #059669, red #DC2626). Create `.env.local` with placeholder values for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, RESEND_API_KEY. After init, call the `init` tool from the next-devtools-mcp server to establish Next.js docs context. Before writing any Next.js code in future steps, always read the relevant doc from `node_modules/next/dist/docs/`. Do NOT build any pages yet.
**Test:** `npm run dev` starts without errors. AGENTS.md exists at project root.
**User action needed:** Fill in .env.local values from Supabase dashboard. Update .mcp.json with your Supabase project ref.

### Step 2: Supabase Client + Login Page
Create `src/lib/supabase/client.ts` (browser client using createBrowserClient from @supabase/ssr). Create `src/lib/supabase/server.ts` (server client using createServerClient with cookies). Create `middleware.ts` at project root for auth session refresh. Create `/login` page with email input and "Send Magic Link" button that calls `supabase.auth.signInWithOtp({ email })`. Show success message on send. Create `/auth/callback/route.ts` to handle magic link redirect and exchange code for session. Clean centered layout, mobile-friendly.
**Test:** `/login` loads without console errors. Email input and button visible.
**User action needed:** Test magic link with real email.

### Step 3: Routing + Layouts
Add role-based routing to middleware: unauthenticated → /login, authenticated without completed profile → /onboarding, shooter → crew routes, admin → admin routes. Create placeholder pages: /dashboard, /weddings, /calendar, /profile, /onboarding, /admin/roster, /admin/calendar, /admin/weddings. Create `(crew)/layout.tsx` with bottom nav (Dashboard, Weddings, Calendar, Profile) for mobile. Create `(admin)/layout.tsx` with sidebar nav (Roster, Calendar, Weddings). Both include logout button.
**Test:** Login redirects to /onboarding (no profile yet). All placeholder pages load.

### Step 4: Onboarding Step 1 — Basic Info
Build multi-step onboarding at /onboarding. Progress indicator showing 4 steps. Step 1: name (required), email (pre-filled read-only), phone (required), pronouns (optional), bio (textarea max 150 chars with live counter, required), headshot upload to Supabase Storage "headshots" bucket with preview. Next button validates, saves partial row to shooter_profiles (onboarding_completed = false). Steps 2-4 show placeholder.
**Test:** Complete step 1. Check Supabase for shooter_profiles row with name and headshot_url.

### Step 5: Onboarding Steps 2-4
Step 2 — Roles & Rates: employee/contractor toggle, 6 role checkboxes (Lead Photographer, Second Photographer, Lead Videographer, Second Videographer, Photobooth Operator, Drone Operator), rate input per selected role. Saves to existing row. Step 3 — Personality: 8 sliders (1-5) with labeled endpoints per PRD.md F2. Saves as JSON to personality_scores. Step 4 — Skills: 14 sliders (1-5) per PRD.md F2. Complete button saves to skill_scores, sets onboarding_completed = true, redirects to /dashboard. Back buttons work on 2-4.
**Test:** Complete all steps. Land on /dashboard. Supabase row fully populated. /onboarding redirects to /dashboard.

### Step 6: Profile Page
Build /profile displaying all shooter_profiles data: large headshot, name, pronouns, bio, phone, email, employee/contractor badge, roles as colored badges, rate per role, personality scores as visual bars with labels, skill scores as visual bars, "Last updated" date. Edit button toggles editable mode. Save persists to Supabase. Mobile-first.
**Test:** All data displays. Edit bio, save, refresh — persists.

### Step 7: Admin Roster
Build /admin/roster. Table of shooters (onboarding_completed = true): headshot circle, name, role badges, employee/contractor badge, last updated. Search by name. Filter by role dropdown. Click row → detail panel with full profile including all personality + skill scores as visual bars. Desktop-first.
**Test:** As admin, roster shows test shooter. Click → full profile detail with scores.

### Step 8: Shooter Calendar
Build /calendar. Month grid (CSS grid, no library). Prev/next month arrows. Day cells: default (available), red dot (blocked), gold dot with initials (assigned). Tap available → block (optimistic UI, insert blocked_dates row). Tap blocked → unblock (delete row). Tap gold → navigate to /weddings/[id]. Fetch blocked_dates + assignments for visible month on mount. Mobile-first, min 44px touch targets.
**Test:** Block 3 dates, refresh — persist. Unblock 1, refresh — gone.

### Step 9: Admin Master Calendar
Build /admin/calendar. Grid: rows = shooters (headshot + name), columns = 30 days from today. Horizontal scroll. Cells: green (available), red (blocked), gold (assigned with couple initials), gray (past). Click green cell → popover with "Assign to wedding" dropdown of weddings on that date. Role filter dropdown. Desktop-focused.
**Test:** Grid shows with test shooter. Blocked dates red. Green cells visible.

### Step 10: Wedding Creation + List
Build /admin/weddings. Table sorted by date: date, couple names, venue, assigned count, status badge. "Create Wedding" button → form: couple names (creates couples row), date picker, venue name, venue address. Save → creates couple + wedding (status draft), redirects to detail page. Wedding detail (/admin/weddings/[id]): header with couple/date/venue, Team section (empty initially), "Edit Brief" button (placeholder), "Add Shooter" button.
**Test:** Create wedding, appears in list, click into detail page.

### Step 11: Assignments + Email
Install `resend`. On wedding detail, "Add Shooter" → panel showing available shooters (not blocked, not already assigned on this date). Shooter cards: headshot, name, roles. Select → role dropdown → save creates assignment. Create `/api/notify` route handler. Send email via Resend on assignment: subject "You've been assigned to [Couple]'s wedding", body with date/venue/role and app link. Show assigned shooters on detail page with remove button.
**Test:** Assign shooter. Email arrives. Shooter shows on detail page. Remove works.

### Step 12: Shooter Dashboard + Weddings List
Build real /dashboard. Next Wedding card: couple names, date, venue, role, countdown, "View Brief" button. Empty state if no assignments. Action Items section (placeholder "No open items" for now). Build /weddings list: upcoming assignments sorted by date, cards with date/couple/venue/role/status badge. Tap → /weddings/[id] (placeholder brief view for now).
**Test:** Shooter sees Next Wedding card. Weddings list shows assignment. Calendar shows gold dot.

### Step 13: Brief Builder Part 1
Build /admin/weddings/[id]/brief. Tabbed or accordion sections. COUPLE PROFILE: pre-fill from couples table, fields per PRD.md F12 (names, pronouns, description, energy dropdown, best_day_ever, excited_about, nervous_about). Save updates couples row AND snapshots to weddings.brief_couple_data. LOGISTICS: venue name/address (pre-filled), coordinator name/phone, gear notes, meal plan, wrap time, file deadline. Save to weddings columns.
**Test:** Fill couple profile + logistics. Save. Refresh — persists. Supabase has brief_couple_data populated.

### Step 14: Brief Builder Part 2 + Publish
Add TIMELINE section: dynamic row editor, each block has time/event/approach notes/key shots/priority checkbox. Reorder + delete. Saves to weddings.timeline JSONB. Add QUIZ section: dynamic question editor, each has question text + 4 options + correct answer radio. Saves to weddings.quiz_questions. Show count "X of 5 minimum." PUBLISH button: disabled if < 5 quiz questions. Sets status = published. Sends email to assigned shooters via /api/notify.
**Test:** Add 3 timeline blocks + 5 quiz questions. Save. Publish. Shooter email arrives.

### Step 15: Shooter Brief View
Build /weddings/[id] brief view. Beautiful scrollable mobile-first page. Section 1 Meet the Couple: initials avatar, names, pronouns, description, energy, best_day_ever, excited_about, nervous_about — warm personal styling. Section 2 Timeline: cards with time/event/approach/key shots, gold left border on priority. Section 3 Team: other shooters name/role/phone, team notes. Section 4 Logistics: tappable venue address, coordinator, gear, meal, wrap, deadline. Section 5 Quiz CTA: sticky bottom button "Take the quiz", disabled for 2 minutes with visible countdown. On first open: set assignment.brief_read = true, brief_read_at = now().
**Test:** Brief renders all data. Timer counts down. After 2 min, button activates. Supabase shows brief_read = true.

### Step 16: Pre-Wedding Quiz
Build quiz at /weddings/[id]/quiz. One question at a time, centered. Question text + 4 tappable cards. On tap: green/red feedback, auto-advance. Progress "Question X of Y". 100% to pass. Fail: summary + "Review and retake" button. Pass: celebration + "You're ready!" On pass: update assignment quiz_passed/quiz_passed_at, increment quiz_attempts. Insert quiz_responses row. On fail: still increment attempts + insert response with passed = false.
**Test:** Take quiz, get one wrong. Fail screen. Retake, all correct. Pass screen. Supabase: quiz_passed = true, attempts = 2, two quiz_responses rows.

### Step 17: Admin Visibility + Reminders
On /admin/weddings list: quiz status dots per shooter per wedding (green/red/gray). On wedding detail: each assignment shows brief_read + quiz_passed + timestamps + attempts. On shooter dashboard: Action Items now real — "Quiz not completed for [Couple]'s wedding" with red badge if quiz incomplete. Create `/api/quiz-reminder` route: finds assignments where quiz_passed = false and wedding within 48 hours, sends reminder emails. Add "Send Reminders" button on admin weddings page.
**Test:** Admin sees colored dots. Shooter sees action item. Send Reminders triggers email.

## After Completing a Step

1. Run `npm run build` to verify no build errors
2. Run the test described above
3. If test passes: update `docs/BUILD_STATE.md` with the next step number and a brief note of what was completed
4. If test fails: fix the issue, retest, then advance
5. Report to the user: what was built, test result, and what the next step will do

## If the User Reports an Error

Read the error carefully. Check the relevant files. Fix the root cause. Do not add workarounds. Rerun the test. Only advance after the test passes.
