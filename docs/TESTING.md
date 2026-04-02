# PreWedd Crew — Test Checkpoints

Every build step has a test. Don't move to the next step until the test passes. If it fails, paste the error to Claude Code and say "this test failed: [description]" — don't try to debug it yourself.

---

## Step 1: Project Init
**Test:** Run `npm run dev`. Browser opens to localhost:3000. You see a Next.js page. No errors in terminal.

## Step 2: Supabase Connection
**Test:** The login page loads at `/login`. No console errors about missing Supabase URL. You see an email input and a button.

## Step 3: Magic Link Auth
**Test:**
1. Enter your real email on `/login` and click Send
2. Check your email — you get a magic link from Supabase
3. Click the link — you land on `/onboarding` (first time) or `/dashboard` (if profile exists)
4. Refresh the page — you stay logged in (session persists)

## Step 4: Onboarding Step 1 (Basic Info)
**Test:** You see a form with name, phone, pronouns, bio, and headshot upload. Fill it out. Click Next. Fields save (no error). You advance to step 2.

## Step 5: Onboarding Steps 2-4 (Roles, Personality, Skills)
**Test:**
1. Step 2: Check some role boxes, enter rates, click Next
2. Step 3: Move all 8 sliders, click Next
3. Step 4: Move all 14 sliders, click Complete
4. You land on `/dashboard`. Going back to `/onboarding` redirects you to `/dashboard` (can't redo onboarding)

## Step 6: Profile Page
**Test:** Go to `/profile`. You see everything you entered during onboarding. Click Edit, change your bio, save. Refresh — the change persists.

## Step 7: Admin Roster
**Test:**
1. In Supabase dashboard, change your user's role to `admin` in the `users` table
2. Refresh the app — you should see the admin nav (Roster, Calendar, Weddings)
3. Go to `/admin/roster` — you see yourself listed with your headshot, roles, and name
4. Click your row — you see your full personality and skill scores

## Step 8: Shooter Calendar
**Test:**
1. Switch your role back to `shooter` (or use a second email)
2. Go to `/calendar` — you see a month grid
3. Tap a date — it turns red (blocked). Tap again — it clears
4. Refresh the page — your blocks are still there

## Step 9: Admin Master Calendar
**Test:**
1. As admin, go to `/admin/calendar`
2. You see a grid with your test shooter as a row
3. The dates they blocked show as red cells
4. Green cells are available

## Step 10: Wedding Creation
**Test:**
1. As admin, go to `/admin/weddings` and click Create Wedding
2. Enter a couple name, pick a date, add a venue
3. Save — the wedding appears in the list
4. Click into it — you see the wedding detail page

## Step 11: Assignment Flow
**Test:**
1. On the wedding detail page, click Add Shooter
2. You see available shooters for that date (your test shooter should appear if they're not blocked)
3. Select them, pick a role, save
4. The shooter now shows as assigned on the wedding

## Step 12: Shooter Sees Assignment
**Test:**
1. Log in as the shooter
2. Dashboard shows the Next Wedding card with couple name, date, venue, role
3. `/weddings` list shows the assignment
4. `/calendar` shows a gold dot on that date

## Step 13: Brief Builder
**Test:**
1. As admin, open the wedding and go to the brief editor
2. Fill in the couple profile section (names, energy, best day ever, etc.)
3. Add 3+ timeline blocks with approach notes
4. Add 5+ quiz questions with correct answers marked
5. Click Publish — status changes to Published

## Step 14: Shooter Brief View
**Test:**
1. Log in as the shooter
2. Open the wedding from dashboard or weddings list
3. You see the full brief: couple profile at top, timeline cards, logistics
4. A timer counts down before the quiz button activates
5. After 2 minutes, the "Take Quiz" button becomes active

## Step 15: Quiz
**Test:**
1. Click Take Quiz
2. Answer all questions — get one wrong on purpose
3. You should fail and see "Review brief and retake"
4. Retake — answer all correctly
5. You see a pass confirmation
6. Back on the wedding card, it shows a green checkmark

## Step 16: Admin Sees Quiz Status
**Test:**
1. As admin, go to `/admin/weddings`
2. The wedding row shows a green dot next to the shooter's name
3. Click into the wedding — you see quiz passed, timestamp, and attempt count

## Step 17: Email Notifications
**Test:**
1. As admin, assign a new shooter to a wedding (or create a new test)
2. Check the shooter's email — they should receive an assignment notification
3. Publish a brief — shooter should receive a "brief ready" email

---

## Quick Smoke Test (Run This After Every Session)

Do this 2-minute check after every Claude Code session to make sure nothing broke:

1. Load the app — no white screen, no console errors
2. Log in works (magic link or existing session)
3. Dashboard loads with data (or empty state)
4. Calendar loads and shows correct blocked/assigned dates
5. Admin roster loads with all shooters
6. Click into a wedding — brief renders without errors

If any of these fail, paste the browser console error to Claude Code before doing anything else.
