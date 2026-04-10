-- 20260409190000_change_assignment_role.sql
-- Server-validated assignment role change with atomic conflict handling.
--
-- Design: mirrors assign_shooter (20260402013500) — SECURITY DEFINER, auth.uid()
-- admin check, FOR UPDATE row locks, jsonb error-as-data.
--
-- Conflict model: the target role on the target wedding may already be held by
-- one or more other assignments. The client picks ONE specific row to act on
-- (p_conflict_assignment_id) and the server verifies that row is still a
-- conflict under lock. Deadlock is avoided by acquiring both row locks in
-- deterministic uuid order (smaller first).

CREATE OR REPLACE FUNCTION public.change_assignment_role(
  p_assignment_id uuid,
  p_new_role text,
  p_conflict_action text DEFAULT NULL,        -- 'swap' | 'remove_other' | 'add_to' | NULL
  p_conflict_assignment_id uuid DEFAULT NULL  -- required for 'swap' & 'remove_other'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role text;
  v_this_probe record;
  v_conflict_probe record;
  v_this record;
  v_this_shooter_roles text[];
  v_conflicts jsonb;
  v_conflict record;
BEGIN
  -- ── 1. Admin auth ────────────────────────────────────────────────────────
  SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- ── 2. Deterministic lock acquisition ────────────────────────────────────
  -- Lock-free probe first, so we know which rows we're about to lock.
  SELECT id, wedding_id, shooter_id, role INTO v_this_probe
  FROM public.assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF p_conflict_assignment_id IS NOT NULL THEN
    SELECT id, wedding_id, shooter_id, role INTO v_conflict_probe
    FROM public.assignments WHERE id = p_conflict_assignment_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'conflict_row_gone');
    END IF;
    IF v_conflict_probe.wedding_id <> v_this_probe.wedding_id THEN
      RETURN jsonb_build_object('error', 'conflict_mismatch');
    END IF;
  END IF;

  -- Acquire locks in uuid order (smaller first) to prevent cross-swap deadlocks.
  IF p_conflict_assignment_id IS NOT NULL
     AND p_conflict_assignment_id < p_assignment_id THEN
    PERFORM 1 FROM public.assignments WHERE id = p_conflict_assignment_id FOR UPDATE;
    PERFORM 1 FROM public.assignments WHERE id = p_assignment_id         FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.assignments WHERE id = p_assignment_id         FOR UPDATE;
    IF p_conflict_assignment_id IS NOT NULL THEN
      PERFORM 1 FROM public.assignments WHERE id = p_conflict_assignment_id FOR UPDATE;
    END IF;
  END IF;

  -- Re-read under lock (state may have changed between probe and lock acquisition).
  SELECT id, wedding_id, shooter_id, role INTO v_this
  FROM public.assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- ── 3. No-op guard ───────────────────────────────────────────────────────
  IF p_new_role = v_this.role THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  -- ── 4. Shooter must hold the new role ────────────────────────────────────
  SELECT roles INTO v_this_shooter_roles
  FROM public.shooter_profiles WHERE id = v_this.shooter_id;
  IF v_this_shooter_roles IS NULL OR NOT (p_new_role = ANY(v_this_shooter_roles)) THEN
    RETURN jsonb_build_object('error', 'invalid_role');
  END IF;

  -- ── 5. Conflict discovery (return all rows, not just one) ────────────────
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',           a.id,
      'shooter_id',   a.shooter_id,
      'shooter_name', sp.name,
      'role',         a.role,
      'can_swap',     (v_this.role = ANY(sp.roles))
    )
    ORDER BY sp.name
  )
  INTO v_conflicts
  FROM public.assignments a
  JOIN public.shooter_profiles sp ON sp.id = a.shooter_id
  WHERE a.wedding_id = v_this.wedding_id
    AND a.role = p_new_role
    AND a.id <> p_assignment_id;

  -- ── 6. No-conflict path ──────────────────────────────────────────────────
  IF v_conflicts IS NULL THEN
    UPDATE public.assignments SET role = p_new_role WHERE id = p_assignment_id;
    RETURN jsonb_build_object('ok', true, 'action', 'updated');
  END IF;

  -- ── 7. Conflict + no action specified → return list for UI prompt ───────
  IF p_conflict_action IS NULL THEN
    RETURN jsonb_build_object('error', 'conflict', 'conflicts', v_conflicts);
  END IF;

  -- ── 8. Swap ──────────────────────────────────────────────────────────────
  IF p_conflict_action = 'swap' THEN
    IF p_conflict_assignment_id IS NULL THEN
      RETURN jsonb_build_object('error', 'missing_conflict_assignment_id');
    END IF;

    SELECT a.id, a.shooter_id, a.role, sp.roles AS other_roles, sp.name AS other_name
    INTO v_conflict
    FROM public.assignments a
    JOIN public.shooter_profiles sp ON sp.id = a.shooter_id
    WHERE a.id = p_conflict_assignment_id;

    IF v_conflict.role <> p_new_role OR v_conflict.id IS NULL THEN
      RETURN jsonb_build_object('error', 'conflict_row_stale');
    END IF;

    IF NOT (v_this.role = ANY(v_conflict.other_roles)) THEN
      RETURN jsonb_build_object(
        'error', 'cannot_swap',
        'message', format('Cannot swap — %s does not hold %s', v_conflict.other_name, v_this.role)
      );
    END IF;

    UPDATE public.assignments SET role = v_this.role  WHERE id = v_conflict.id;
    UPDATE public.assignments SET role = p_new_role   WHERE id = p_assignment_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'swapped',
      'swapped_with_assignment_id', v_conflict.id,
      'swapped_with_shooter_id',    v_conflict.shooter_id
    );
  END IF;

  -- ── 9. Remove other ──────────────────────────────────────────────────────
  IF p_conflict_action = 'remove_other' THEN
    IF p_conflict_assignment_id IS NULL THEN
      RETURN jsonb_build_object('error', 'missing_conflict_assignment_id');
    END IF;

    SELECT id, role INTO v_conflict_probe
    FROM public.assignments WHERE id = p_conflict_assignment_id;
    IF NOT FOUND OR v_conflict_probe.role <> p_new_role THEN
      RETURN jsonb_build_object('error', 'conflict_row_stale');
    END IF;

    DELETE FROM public.assignments WHERE id = p_conflict_assignment_id;
    UPDATE public.assignments SET role = p_new_role WHERE id = p_assignment_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'removed_other',
      'removed_assignment_id', p_conflict_assignment_id
    );
  END IF;

  -- ── 10. Add to (duplicate role allowed) ──────────────────────────────────
  IF p_conflict_action = 'add_to' THEN
    UPDATE public.assignments SET role = p_new_role WHERE id = p_assignment_id;
    RETURN jsonb_build_object('ok', true, 'action', 'added_to');
  END IF;

  -- ── 11. Unknown action ──────────────────────────────────────────────────
  RETURN jsonb_build_object('error', 'invalid_action');
END;
$$;

REVOKE ALL ON FUNCTION public.change_assignment_role(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_assignment_role(uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.change_assignment_role(uuid, text, text, uuid) TO authenticated;
