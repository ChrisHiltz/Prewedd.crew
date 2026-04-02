# PreWedd Crew — Database Schema

## Overview
All tables live in a single Supabase (Postgres) project. Tables are designed to be shared with the future Pre-Wed App (couple-facing). The `users` table is the shared auth foundation. Row Level Security (RLS) is mandatory on every table.

## Tables

### users
Managed by Supabase Auth. Extended with a `role` field.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | From Supabase Auth |
| email | text | Unique, from Auth |
| role | text | `shooter`, `admin`, `couple` |
| created_at | timestamptz | Default now() |
| last_login | timestamptz | Updated on auth event |

**RLS:**
- Users can read their own row
- Admins can read all rows

---

### shooter_profiles
One row per shooter. Created during onboarding.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| user_id | uuid (FK → users.id) | Unique, on delete cascade |
| name | text | Required |
| phone | text | Required |
| pronouns | text | Optional |
| bio | text | Max 150 chars |
| headshot_url | text | Supabase Storage path |
| is_employee | boolean | Default false (contractor) |
| roles | text[] | Array: `lead_photo`, `second_photo`, `lead_video`, `second_video`, `photobooth`, `drone` |
| rates | jsonb | `{ "lead_photo": 500, "second_photo": 300, ... }` — dollar amount per role |
| personality_scores | jsonb | `{ "energy": 3, "directing": 4, "communication": 2, ... }` — 8 keys, values 1-5 |
| skill_scores | jsonb | `{ "getting_ready": 4, "details": 5, "ceremony": 3, ... }` — 14 keys, values 1-5 |
| onboarding_completed | boolean | Default false, set true when onboarding finishes |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Updated on any edit |

**RLS:**
- Shooter can read/update their own profile
- Admins can read all profiles
- No shooter can read another shooter's profile

**Indexes:**
- `user_id` (unique)
- `roles` (GIN for array containment queries)

---

### couples
Couple data from planning calls. Populated by admin.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| names | text | "Austin & JJ", "Sarah & Mike" |
| pronouns | text | Optional |
| description | text | One-liner: "High school sweethearts, both teachers" |
| energy_profile | jsonb | `{ "general_energy": "introverted", "affection_style": "playful", "camera_comfort": 3, "stress_style": "go_with_flow" }` |
| coverage_priorities | jsonb | `{ "getting_ready": "high", "details": "high", "ceremony": "medium", ... }` |
| best_day_ever | text | In their own words from planning call |
| excited_about | text | |
| nervous_about | text | |
| notes | text | Freeform admin notes |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | |

**RLS:**
- Admins only (shooters see couple data only through the brief view, which is denormalized into the wedding record)

---

### weddings
Each wedding event. Contains the brief data as JSON.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| couple_id | uuid (FK → couples.id) | |
| date | date | Wedding date |
| venue_name | text | |
| venue_address | text | |
| coordinator_name | text | Optional |
| coordinator_phone | text | Optional |
| gear_notes | text | Gear pack assignment notes |
| meal_plan | text | Optional |
| wrap_time | time | Expected end time |
| file_deadline | text | When files are due for upload |
| status | text | `draft`, `published` |
| brief_couple_data | jsonb | Denormalized snapshot of couple profile for the brief |
| timeline | jsonb | Array of timeline blocks: `[{ "time": "2:00 PM", "event": "Bride getting ready", "approach_notes": "...", "key_shots": "...", "is_priority": true }]` |
| team_notes | text | How the team should coordinate |
| quiz_questions | jsonb | Array: `[{ "question": "...", "options": ["A","B","C","D"], "correct_index": 2 }]` |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | |

**RLS:**
- Admins can CRUD
- Shooters can read weddings they're assigned to (via assignments table join)

**Indexes:**
- `date`
- `couple_id`
- `status`

---

### assignments
Links shooters to weddings. The operational backbone.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| wedding_id | uuid (FK → weddings.id) | On delete cascade |
| shooter_id | uuid (FK → shooter_profiles.id) | On delete cascade |
| role | text | The role for this specific wedding: `lead_photo`, `second_photo`, etc. |
| status | text | `assigned`, `confirmed` |
| brief_read | boolean | Default false — set true when shooter opens the brief |
| brief_read_at | timestamptz | Nullable |
| quiz_passed | boolean | Default false |
| quiz_passed_at | timestamptz | Nullable |
| quiz_attempts | integer | Default 0 |
| created_at | timestamptz | Default now() |

**RLS:**
- Shooters can read their own assignments, update `brief_read` and quiz fields
- Admins can CRUD all assignments

**Indexes:**
- `wedding_id`
- `shooter_id`
- Unique constraint on `(wedding_id, shooter_id)`

---

### blocked_dates
Shooter unavailability. Simple date blocking.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| shooter_id | uuid (FK → shooter_profiles.id) | On delete cascade |
| date | date | The blocked date |
| reason | text | Optional |
| created_at | timestamptz | Default now() |

**RLS:**
- Shooters can CRUD their own blocked dates
- Admins can read all

**Indexes:**
- `shooter_id`
- `date`
- Unique constraint on `(shooter_id, date)`

---

### quiz_responses
Logged quiz attempts for accountability tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default gen_random_uuid() |
| assignment_id | uuid (FK → assignments.id) | On delete cascade |
| responses | jsonb | `[{ "question_index": 0, "selected_index": 2, "correct": true }]` |
| passed | boolean | |
| completed_at | timestamptz | Default now() |

**RLS:**
- Shooters can insert their own (via assignment ownership), read their own
- Admins can read all

---

## Key Queries the App Needs

### "Who's available on May 2nd?"
```sql
SELECT sp.* FROM shooter_profiles sp
WHERE sp.onboarding_completed = true
  AND sp.id NOT IN (
    SELECT shooter_id FROM blocked_dates WHERE date = '2026-05-02'
  )
  AND sp.id NOT IN (
    SELECT shooter_id FROM assignments a
    JOIN weddings w ON a.wedding_id = w.id
    WHERE w.date = '2026-05-02'
  );
```

### "Which weddings still need shooters?"
```sql
SELECT w.*, c.names as couple_names,
  (SELECT count(*) FROM assignments WHERE wedding_id = w.id) as assigned_count
FROM weddings w
JOIN couples c ON w.couple_id = c.id
WHERE w.date >= CURRENT_DATE
ORDER BY w.date;
```

### "Has everyone passed their quiz for this weekend's weddings?"
```sql
SELECT w.date, c.names, sp.name as shooter_name, a.role,
  a.brief_read, a.quiz_passed, a.quiz_attempts
FROM assignments a
JOIN weddings w ON a.wedding_id = w.id
JOIN couples c ON w.couple_id = c.id
JOIN shooter_profiles sp ON a.shooter_id = sp.id
WHERE w.date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
ORDER BY w.date, sp.name;
```

### "Master calendar: all shooters × all dates"
```sql
SELECT sp.id, sp.name, sp.roles,
  d.date,
  CASE
    WHEN bd.id IS NOT NULL THEN 'blocked'
    WHEN a.id IS NOT NULL THEN 'assigned'
    ELSE 'available'
  END as status,
  c.names as couple_names
FROM shooter_profiles sp
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + interval '90 days', '1 day') as d(date)
LEFT JOIN blocked_dates bd ON bd.shooter_id = sp.id AND bd.date = d.date
LEFT JOIN assignments a ON a.shooter_id = sp.id
  LEFT JOIN weddings w ON a.wedding_id = w.id AND w.date = d.date
  LEFT JOIN couples c ON w.couple_id = c.id
WHERE sp.onboarding_completed = true
ORDER BY sp.name, d.date;
```
