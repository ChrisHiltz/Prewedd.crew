# Build State

step: 10
status: complete

## Progress Log
<!-- Each completed step gets logged here automatically -->
- **Step 1-5** — Project init, auth, routing, onboarding (all 4 steps).
- **Step 6: Profile Page** — Full profile display + edit mode for all fields.
- **Step 7: Admin Roster** — Desktop table with search, role filter, detail panel with admin editing.
- **Step 8: Shooter Calendar** — Mobile month grid with optimistic block/unblock, verified Supabase sync.
- **Step 9: Admin Master Calendar** — Wedding-date-only columns with month navigation, shooter rows, role filter.
- **Step 10: Wedding Creation + List** — /admin/weddings list table sorted by date: couple names, venue, assigned count, status badge. "Create Wedding" inline form: couple names (creates couples row), date picker, venue name/address. Saves couple + wedding (draft), redirects to detail page. /admin/weddings/[id] detail: header with couple/date/venue/status, Team section showing assignments with brief_read and quiz_passed dots, "Edit Brief" link (placeholder), "Add Shooter" button (placeholder for Step 11). Build passes.
