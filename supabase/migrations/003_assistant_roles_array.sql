-- 003_assistant_roles_array.sql
-- Convert assistant_roles from text to text[] so multiple assistant role types can be stored.
-- Existing non-null single values are wrapped in an array. NULL stays NULL.
-- Normalize legacy free-text to canonical role keys during migration.

ALTER TABLE public.weddings
  ALTER COLUMN assistant_roles TYPE text[]
  USING CASE
    WHEN assistant_roles IS NULL THEN NULL
    ELSE ARRAY[assistant_roles]
  END,
  ALTER COLUMN assistant_roles SET DEFAULT ARRAY[]::text[];

-- Normalize any legacy free-text values to canonical role keys.
UPDATE public.weddings
SET assistant_roles = ARRAY(
  SELECT CASE
    WHEN lower(trim(elem)) IN ('photobooth', 'photobooth operator') THEN 'photobooth'
    WHEN lower(trim(elem)) IN ('drone', 'drone operator') THEN 'drone'
    WHEN lower(trim(elem)) IN ('assistant', 'second assistant') THEN 'assistant'
    WHEN trim(elem) IN ('lead_photo','second_photo','lead_video','second_video','photobooth','drone','assistant') THEN trim(elem)
    ELSE 'assistant'
  END
  FROM unnest(assistant_roles) AS elem
)
WHERE assistant_roles IS NOT NULL AND array_length(assistant_roles, 1) > 0;

-- Atomic assignment function: validates + inserts in a single transaction.
CREATE OR REPLACE FUNCTION public.assign_shooter(
  p_wedding_id uuid,
  p_shooter_id uuid,
  p_role text,
  p_swap_from_wedding_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
  v_shooter_roles text[];
  v_wedding_date date;
  v_conflict_row record;
  v_old_assignment record;
  v_new_id uuid;
BEGIN
  SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT roles INTO v_shooter_roles FROM public.shooter_profiles WHERE id = p_shooter_id;
  IF v_shooter_roles IS NULL OR NOT (p_role = ANY(v_shooter_roles)) THEN
    RETURN jsonb_build_object('error', 'invalid_role');
  END IF;

  PERFORM 1 FROM public.shooter_profiles WHERE id = p_shooter_id FOR UPDATE;

  SELECT date INTO v_wedding_date FROM public.weddings WHERE id = p_wedding_id;
  IF v_wedding_date IS NULL THEN
    RETURN jsonb_build_object('error', 'wedding_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.blocked_dates WHERE shooter_id = p_shooter_id AND date = v_wedding_date) THEN
    RETURN jsonb_build_object('error', 'blocked');
  END IF;

  SELECT a.id, a.wedding_id, a.role, a.status, a.brief_read, a.quiz_passed,
         c.names as couple_name
  INTO v_conflict_row
  FROM public.assignments a
  JOIN public.weddings w ON w.id = a.wedding_id
  LEFT JOIN public.couples c ON c.id = w.couple_id
  WHERE a.shooter_id = p_shooter_id
    AND w.date = v_wedding_date
    AND a.wedding_id != p_wedding_id
  LIMIT 1;

  IF v_conflict_row IS NOT NULL THEN
    IF p_swap_from_wedding_id IS NULL THEN
      RETURN jsonb_build_object(
        'error', 'conflict',
        'conflicting_wedding', jsonb_build_object(
          'id', v_conflict_row.wedding_id,
          'couple_name', COALESCE(v_conflict_row.couple_name, 'Unknown'),
          'role', v_conflict_row.role
        )
      );
    END IF;

    IF p_swap_from_wedding_id != v_conflict_row.wedding_id THEN
      RETURN jsonb_build_object('error', 'stale_conflict');
    END IF;

    DELETE FROM public.assignments
    WHERE wedding_id = p_swap_from_wedding_id AND shooter_id = p_shooter_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.assignments WHERE wedding_id = p_wedding_id AND shooter_id = p_shooter_id) THEN
    RETURN jsonb_build_object('error', 'duplicate');
  END IF;

  INSERT INTO public.assignments (wedding_id, shooter_id, role, status)
  VALUES (p_wedding_id, p_shooter_id, p_role, 'assigned')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'assignment_id', v_new_id,
    'swapped_from', CASE WHEN p_swap_from_wedding_id IS NOT NULL THEN p_swap_from_wedding_id ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_shooter FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_shooter FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_shooter TO authenticated;
