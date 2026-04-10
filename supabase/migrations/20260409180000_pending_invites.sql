-- 20260409180000_pending_invites.sql
-- Creates the pending_invites table and updates handle_new_user() to read from it.
-- Idempotent: safe to run multiple times and against an environment where the table
-- and trigger already exist (production had this applied via CLI before the repo caught up).

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('shooter', 'admin')),
  invited_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_invites_email_idx ON public.pending_invites(email);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (so CREATE POLICY below is idempotent)
DROP POLICY IF EXISTS "Admins manage pending_invites" ON public.pending_invites;

CREATE POLICY "Admins manage pending_invites" ON public.pending_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Trigger function ────────────────────────────────────────────────────────
-- When a new auth user is created, check pending_invites for their email.
-- If found, use that role; otherwise default to 'shooter'. Clean up the pending row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.pending_invites
  WHERE email = NEW.email
  LIMIT 1;

  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(v_role, 'shooter'));

  DELETE FROM public.pending_invites WHERE email = NEW.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
