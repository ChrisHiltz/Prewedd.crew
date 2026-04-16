-- 20260409190500_notify_rate_limit.sql
-- DB-backed rate limit for /api/notify and /api/assignment-notify.
--
-- Design notes:
-- • Fixed one-minute bucket keyed on date_trunc('minute', now()) in UTC.
--   NOT a sliding 60-second window. An admin who sends 30 emails at 12:34:59
--   and 1 more at 12:35:00 is allowed through, because the bucket rolled.
-- • Identity is derived from auth.uid() inside the SECURITY DEFINER body.
--   The caller never passes an admin id — this closes "spend another user's
--   quota" + "probe for other admins" attacks.
-- • Atomic increment via INSERT ... ON CONFLICT DO UPDATE RETURNING under
--   Postgres row locks. No race window.
-- • Shared by /api/notify and /api/assignment-notify so the 30/min budget
--   is a single bucket per admin across both routes.

CREATE TABLE IF NOT EXISTS public.notify_rate_limits (
  admin_id uuid NOT NULL,
  window_start timestamptz NOT NULL,  -- truncated to the minute (UTC)
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (admin_id, window_start)
);

-- RLS on. Only the SECURITY DEFINER function touches this table; no direct
-- client access. No policies created → default deny for authenticated role.
ALTER TABLE public.notify_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_notify_rate_limit(
  p_limit int DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_window timestamptz := date_trunc('minute', now());
  v_count int;
  v_role text;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_admin_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN false;
  END IF;

  -- Atomic increment-and-check. Row lock held for the duration of the txn.
  INSERT INTO public.notify_rate_limits (admin_id, window_start, count)
  VALUES (v_admin_id, v_window, 1)
  ON CONFLICT (admin_id, window_start) DO UPDATE
    SET count = notify_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic sweep of old rows (retention: 1 hour).
  DELETE FROM public.notify_rate_limits
  WHERE window_start < now() - interval '1 hour';

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_notify_rate_limit(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_notify_rate_limit(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_notify_rate_limit(int) TO authenticated;
