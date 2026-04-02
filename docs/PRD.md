# PreWedd Crew MVP — Product Requirements Document

## Overview
PreWedd Crew is an internal team platform for TLIC, a wedding photography and videography studio. It replaces spreadsheets, group texts, and emailed Google Docs with a single app where shooters (photographers, videographers) manage their availability, receive wedding assignments, and review couple-specific briefs.

## Users

### Shooters (10-30+)
Photographers, videographers, and photobooth operators — a mix of W2 employees and contractors. They access the app exclusively via magic link (email). They primarily use mobile.

### Admins (2-3)
Ashley (operations), Dinara (team management), Chris (owner). Full access to all data. They primarily use desktop.

## Core Loop
This is the one cycle the MVP must execute perfectly:

1. **Shooter onboards** → profile created with personality + skills
2. **Shooter blocks unavailable dates** → manual calendar blocking
3. **Admin creates a wedding** → couple profile + brief authored
4. **Admin assigns a shooter** → from availability + profile review
5. **Shooter reviews the brief** → couple context + enriched timeline
6. **Shooter passes the quiz** → proves preparation
7. **Wedding day** → shooter arrives prepared

---

## Feature Specifications

### F1: Magic Link Authentication
- Admin invites a new shooter by entering their email
- Shooter receives an email with a magic link
- Clicking the link authenticates them (no password, no account creation)
- If it's their first login, they enter the onboarding flow
- If they've completed onboarding, they go to the dashboard
- Sessions last 30 days before requiring a new magic link
- Admin users are seeded manually in the database (no self-registration for admin)

### F2: Shooter Onboarding Flow
A multi-step guided flow that doubles as the personality and skill assessment. 4 steps:

**Step 1: Basic Info**
- Name (required)
- Email (pre-filled from magic link, read-only)
- Phone number (required)
- Headshot upload (required — stored in Supabase Storage)
- Pronouns (optional)
- One-line bio (required, max 150 chars — used for couple-facing intros)

**Step 2: Roles & Rates**
- Checkboxes for available roles: Lead Photographer, Second Photographer, Lead Videographer, Second Videographer, Photobooth Operator, Drone Operator
- For each selected role, a rate input field (hourly or per-wedding — just a dollar amount)
- Employee vs. contractor toggle (affects display only for MVP, no payroll logic)

**Step 3: Personality Profile**
8 slider questions, each on a 1-5 scale with labeled endpoints:
1. Energy level on wedding day: Calm & steady ↔ High-energy & hype
2. Directing style: Hands-off / documentary ↔ Actively posing & directing
3. Communication with couples: Quiet & professional ↔ Chatty & warm
4. Schedule pressure response: Stay calm, quietly adjust ↔ Vocalize, rally the group
5. Working with second shooter: Work independently ↔ Coordinate closely
6. With shy couples: Give them space ↔ Actively draw them out
7. Shooting philosophy: Document naturally ↔ Create & direct moments
8. Downtime between events: Hunt for candids & details ↔ Stay near couple / party

**Step 4: Skill Confidence**
14 slider questions, each 1-5 (1 = least confident, 5 = where I thrive):
1. Getting-ready coverage
2. Detail shots (rings, florals, shoes, decor)
3. Ceremony coverage
4. Couple's portrait session (posed/directed)
5. Candid portraits
6. Wedding party group photos
7. Family formal portraits
8. Cocktail hour coverage
9. Reception events (toasts, dances, cake)
10. Dance floor / party
11. Working in harsh/midday sun
12. Working in low light / indoor without flash
13. Flash photography
14. Drone or aerial (if applicable)

**Completion:** Profile is saved. Dashboard unlocks. Welcome confirmation screen.

### F3: Shooter Dashboard (Home)
- **Next Wedding card** (prominent, top of screen): Couple's first names, date, venue, shooter's role, countdown to wedding day, "View Brief" button. If no upcoming wedding: "No weddings yet — your profile is live."
- **Action Items**: Red-badged list of outstanding items (quiz not completed, brief not reviewed). Max 3 shown, "See all" link if more.
- **Recent Notifications**: Last 3 notifications (new assignment, brief updated, quiz reminder).

### F4: Shooter Weddings List
- List of upcoming assignments sorted by date
- Each card shows: date, couple name, venue, shooter's role, brief status indicator (unread / read / quiz passed)
- Tapping a card opens the Brief View (F6)
- No past weddings in MVP (Phase 2)

### F5: Shooter Calendar
- Month view calendar
- Three visual states per date: Available (default, no marker), Blocked (red dot), Assigned wedding (gold dot with couple initials)
- Tap any available date → toggle to blocked (and back)
- Tap any gold date → opens that wedding's brief
- Block/unblock is instant (optimistic UI, syncs to database)

### F6: Shooter Brief View
The full brief for one wedding. Scrollable single page. Sections in order:

**Section 1: Meet the Couple**
- Couple's names and pronouns
- One-line description (who they are)
- Their energy (from couple profile)
- What "best day ever" means to them
- What they're most excited about
- What they're nervous about

**Section 2: Timeline**
Each block has 4 fields displayed as a card:
- Time
- Event name
- Approach notes (how to handle this moment for THIS couple)
- Key shots (what to capture)
Color-coded: gold border on couple's highest-priority moments.

**Section 3: Team & Roles**
- Other shooters on this wedding: name, role, phone number
- Brief note on how to work together (e.g., "You own portraits, they own candids during cocktail hour")

**Section 4: Logistics**
- Venue name and address (tappable for maps on mobile)
- On-site coordinator name and phone
- Gear pack assigned
- Meal plan
- Wrap time
- File upload deadline

**Section 5: Take the Quiz**
- Button at bottom: "I've reviewed — take the quiz"
- Only active after brief has been scrolled/opened for minimum 2 minutes (simple timer, not scroll tracking)

### F7: Pre-Wedding Quiz
- 5-8 questions per wedding, authored by admin when building the brief
- Question types: multiple choice only (keeps it simple)
- Questions test: couple priorities, key moments, timeline-critical items, venue specifics, team coordination
- Pass threshold: 100% (it's 5-8 questions — get them all right)
- Fail: feedback shown, "Review brief and retake" button
- Pass: green checkmark, confirmation screen, admin notified
- Quiz attempts are logged (admin can see how many tries)

### F8: Shooter Profile
- View and edit all onboarding fields
- Headshot, basic info, roles, rates, personality scores, skill scores
- "Last updated" timestamp displayed prominently to encourage seasonal refreshes

### F9: Admin — Team Roster
- Table view of all shooters
- Columns: headshot thumbnail, name, roles (badges), last active, quiz pass rate (weddings passed / total)
- Click any row → full profile detail panel (slides in or new page)
- Filter by: role, employee/contractor
- Search by name

### F10: Admin — Master Calendar
- Grid view: rows = shooters, columns = dates (scrollable)
- Cell states: green (available), red (blocked), gold (assigned), gray (past)
- Click a green cell → assign that shooter to a wedding on that date (dropdown of unassigned weddings on that date)
- Click a gold cell → view assignment details
- Filter rows by role
- This is the "gap analysis" view — instantly see unfilled dates

### F11: Admin — Weddings Manager
- List of all weddings sorted by date
- Each row: date, couple name, venue, staffing status (icon: ✓ fully staffed / ⚠ needs shooters), brief status (draft / published), quiz status per assigned shooter (green/red dots)
- Click into a wedding → edit couple profile, manage assignments, edit brief, view quiz results
- "Create Wedding" button → new wedding form

### F12: Admin — Brief Builder
Structured form for authoring the shooter brief. Sections:

**Couple Profile** (maps to Brief Section 1):
- Names, pronouns, one-line description, energy, best-day-ever, excited-about, nervous-about

**Timeline** (maps to Brief Section 2):
- Row editor: add/remove/reorder timeline blocks
- Each block: time input, event name, approach notes (textarea), key shots (textarea)
- Checkbox to mark as "high priority moment" (gets gold border in brief view)

**Team** (maps to Brief Section 3):
- Assign shooters from roster (dropdown filtered by available on this date)
- Role per assignment
- Team coordination notes (textarea)

**Logistics** (maps to Brief Section 4):
- Venue name, address, coordinator name/phone, gear pack, meal plan, wrap time, file deadline

**Quiz** (maps to F7):
- Add/remove questions
- Each question: question text + 4 answer options + mark correct answer

**Publish button**: Makes brief visible to assigned shooters. Sends notification.

---

## Non-Functional Requirements

### Performance
- Pages load in under 2 seconds on mobile
- Optimistic UI for calendar blocking (no loading spinners for date toggles)
- Brief view should work offline-ish (load once, scrollable without network)

### Security
- RLS on every Supabase table
- Shooters can only see their own profile, their own assignments, their own blocked dates
- Admins can see everything
- No sensitive data in URL parameters
- Headshot uploads restricted to image MIME types, max 5MB

### Mobile
- Shooter screens must be fully responsive and optimized for phone-width viewports
- Admin screens are desktop-first (min 1024px) but should not break on tablet

---

## Out of Scope (Documented for Phase 2+)
- Google/Apple/Outlook calendar sync
- Auto-matching engine
- Earnings/payroll dashboard
- Past weddings list
- Post-wedding debrief form
- Training modules and certifications
- Moodboard gallery (native — link to Pinterest works for MVP)
- SMS notifications
- Season stats and analytics
- Contractor pipeline management
- Add-a-role request flow (admin does manually)
- Real Talk open-ended questions (add after first wedding cycle)
