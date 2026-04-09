-- Wedding extended fields from Streak CSV import
-- Added to support full scheduling dashboard view

ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS services text,
  ADD COLUMN IF NOT EXISTS package text,
  ADD COLUMN IF NOT EXISTS num_photographers integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_videographers integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_assistants integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistant_roles text,
  ADD COLUMN IF NOT EXISTS add_ons text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS ceremony_location text,
  ADD COLUMN IF NOT EXISTS getting_ready_location text,
  ADD COLUMN IF NOT EXISTS dress_code text,
  ADD COLUMN IF NOT EXISTS hours_of_coverage text,
  ADD COLUMN IF NOT EXISTS planner_name text,
  ADD COLUMN IF NOT EXISTS timeline_couple_url text,
  ADD COLUMN IF NOT EXISTS moodboard_url text,
  ADD COLUMN IF NOT EXISTS family_checklist_url text,
  ADD COLUMN IF NOT EXISTS timeline_internal_url text,
  ADD COLUMN IF NOT EXISTS team_confirmation_status text DEFAULT 'Not Confirmed';
