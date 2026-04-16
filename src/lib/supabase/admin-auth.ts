// src/lib/supabase/admin-auth.ts
// Shared admin auth gate for Route Handlers. Single source of truth —
// used by /api/assign, /api/assignment-notify, /api/notify, /api/invite, etc.

import type { createClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated admin's user id, or null if the caller is not
 * authenticated or not an admin. Callers should return 403 on null.
 *
 * @example
 *   const supabase = await createClient();
 *   const adminId = await requireAdmin(supabase);
 *   if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 */
export async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) return null;

  const { data: dbUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  return dbUser?.role === "admin" ? authUser.id : null;
}
