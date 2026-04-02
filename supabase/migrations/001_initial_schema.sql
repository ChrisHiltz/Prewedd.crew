-- PreWedd Crew MVP: Initial Schema
-- Run against Supabase project via `supabase db push` or paste into SQL editor

-- ============================================================
-- USERS: Extended auth table (role field)
-- ============================================================
-- Supabase Auth creates auth.users automatically.
-- We add a public.users table that mirrors auth with our custom fields.

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'shooter' CHECK (role IN ('shooter', 'admin', 'couple')),
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own record" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create public.users row when auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SHOOTER PROFILES
-- ============================================================

CREATE TABLE public.shooter_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  pronouns text,
  bio text CHECK (char_length(bio) <= 150),
  headshot_url text,
  is_employee boolean DEFAULT false,
  roles text[] DEFAULT '{}',
  rates jsonb DEFAULT '{}',
  personality_scores jsonb DEFAULT '{}',
  skill_scores jsonb DEFAULT '{}',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_shooter_profiles_user_id ON public.shooter_profiles(user_id);
CREATE INDEX idx_shooter_profiles_roles ON public.shooter_profiles USING GIN(roles);

ALTER TABLE public.shooter_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shooters can read own profile" ON public.shooter_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Shooters can update own profile" ON public.shooter_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Shooters can insert own profile" ON public.shooter_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON public.shooter_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.shooter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- COUPLES
-- ============================================================

CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  names text NOT NULL,
  pronouns text,
  description text,
  energy_profile jsonb DEFAULT '{}',
  coverage_priorities jsonb DEFAULT '{}',
  best_day_ever text,
  excited_about text,
  nervous_about text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only on couples" ON public.couples
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at_couples
  BEFORE UPDATE ON public.couples
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- WEDDINGS
-- ============================================================

CREATE TABLE public.weddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES public.couples(id),
  date date NOT NULL,
  venue_name text,
  venue_address text,
  coordinator_name text,
  coordinator_phone text,
  gear_notes text,
  meal_plan text,
  wrap_time time,
  file_deadline text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  brief_couple_data jsonb DEFAULT '{}',
  timeline jsonb DEFAULT '[]',
  team_notes text,
  quiz_questions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_weddings_date ON public.weddings(date);
CREATE INDEX idx_weddings_couple_id ON public.weddings(couple_id);
CREATE INDEX idx_weddings_status ON public.weddings(status);

ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with weddings" ON public.weddings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Shooters can read assigned weddings" ON public.weddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.shooter_profiles sp ON a.shooter_id = sp.id
      WHERE a.wedding_id = weddings.id AND sp.user_id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_weddings
  BEFORE UPDATE ON public.weddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- ASSIGNMENTS
-- ============================================================

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  shooter_id uuid NOT NULL REFERENCES public.shooter_profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed')),
  brief_read boolean DEFAULT false,
  brief_read_at timestamptz,
  quiz_passed boolean DEFAULT false,
  quiz_passed_at timestamptz,
  quiz_attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(wedding_id, shooter_id)
);

CREATE INDEX idx_assignments_wedding_id ON public.assignments(wedding_id);
CREATE INDEX idx_assignments_shooter_id ON public.assignments(shooter_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shooters can read own assignments" ON public.assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shooter_profiles sp
      WHERE sp.id = assignments.shooter_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Shooters can update own assignment status" ON public.assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shooter_profiles sp
      WHERE sp.id = assignments.shooter_id AND sp.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shooter_profiles sp
      WHERE sp.id = assignments.shooter_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can do everything with assignments" ON public.assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- BLOCKED DATES
-- ============================================================

CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shooter_id uuid NOT NULL REFERENCES public.shooter_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shooter_id, date)
);

CREATE INDEX idx_blocked_dates_shooter_id ON public.blocked_dates(shooter_id);
CREATE INDEX idx_blocked_dates_date ON public.blocked_dates(date);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shooters can manage own blocked dates" ON public.blocked_dates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shooter_profiles sp
      WHERE sp.id = blocked_dates.shooter_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all blocked dates" ON public.blocked_dates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- QUIZ RESPONSES
-- ============================================================

CREATE TABLE public.quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '[]',
  passed boolean NOT NULL,
  completed_at timestamptz DEFAULT now()
);

ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shooters can insert own quiz responses" ON public.quiz_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.shooter_profiles sp ON a.shooter_id = sp.id
      WHERE a.id = quiz_responses.assignment_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Shooters can read own quiz responses" ON public.quiz_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.shooter_profiles sp ON a.shooter_id = sp.id
      WHERE a.id = quiz_responses.assignment_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all quiz responses" ON public.quiz_responses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- STORAGE: Headshot bucket
-- ============================================================
-- Run in Supabase Dashboard > Storage or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('headshots', 'headshots', true);
-- Policy: authenticated users can upload to their own folder (user_id/)
