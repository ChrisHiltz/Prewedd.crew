// src/app/api/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { buildAssignmentEmail } from "@/lib/utils/notifications";
import { isCrewRole } from "@/lib/utils/roles";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SingleAssignBody {
  wedding_id: string;
  shooter_id: string;
  role: string;
  swap_from_wedding_id?: string;
}

interface BatchAssignBody {
  assignments: { wedding_id: string; shooter_id: string; role: string }[];
}

type Body = SingleAssignBody | BatchAssignBody;

function isBatch(body: Body): body is BatchAssignBody {
  return "assignments" in body && Array.isArray((body as BatchAssignBody).assignments);
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
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

// ─── Email sender (best-effort, called after successful DB commit) ─────────────

async function sendAssignmentEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  wedding_id: string,
  shooter_id: string,
  role: string
) {
  try {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("date, venue_name, couples(names)")
      .eq("id", wedding_id)
      .single();

    const { data: profile } = await supabase
      .from("shooter_profiles")
      .select("name, user_id")
      .eq("id", shooter_id)
      .single();

    if (!profile || !wedding) return;

    const { data: user } = await supabase
      .from("users")
      .select("email")
      .eq("id", profile.user_id)
      .single();

    if (!user?.email) return;

    const couples = wedding.couples as unknown as { names: string } | null;

    const email = buildAssignmentEmail({
      shooterEmail: user.email,
      shooterName: profile.name,
      coupleName: couples?.names ?? "the couple",
      weddingDate: wedding.date,
      venueName: wedding.venue_name ?? null,
      role,
    });

    await resend.emails.send({
      from: "PreWedd Crew <crew@prewedd-mail.com>",
      to: email.to,
      subject: email.subject,
      html: email.html,
    });
  } catch (err) {
    console.error("[api/assign] email send failed:", err);
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const adminId = await requireAdmin(supabase);
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Batch mode ──────────────────────────────────────────────────────────────
  if (isBatch(body)) {
    const { assignments } = body;

    if (!assignments.length) {
      return NextResponse.json({ error: "No assignments provided" }, { status: 400 });
    }

    for (const a of assignments) {
      if (!isCrewRole(a.role)) {
        return NextResponse.json({ error: `Invalid role: ${a.role}` }, { status: 400 });
      }
    }

    const results: { input: (typeof assignments)[0]; result: Record<string, unknown> }[] = [];
    const successes: typeof assignments = [];

    for (const a of assignments) {
      const { data, error: rpcError } = await supabase.rpc("assign_shooter" as never, {
        p_wedding_id: a.wedding_id,
        p_shooter_id: a.shooter_id,
        p_role: a.role,
      });

      if (rpcError) {
        results.push({ input: a, result: { error: (rpcError as { message: string }).message } });
      } else if ((data as Record<string, unknown>)?.error) {
        results.push({ input: a, result: data as Record<string, unknown> });
      } else {
        results.push({ input: a, result: data as Record<string, unknown> });
        successes.push(a);
      }
    }

    const failures = results.filter((r) => r.result.error);
    if (failures.length > 0 && successes.length === 0) {
      return NextResponse.json(
        {
          error: "validation_failed",
          results: results.map((r) => ({
            wedding_id: r.input.wedding_id,
            shooter_id: r.input.shooter_id,
            role: r.input.role,
            ...r.result,
          })),
        },
        { status: 409 }
      );
    }

    await Promise.allSettled(
      successes.map((a) =>
        sendAssignmentEmail(supabase, a.wedding_id, a.shooter_id, a.role)
      )
    );

    return NextResponse.json(
      {
        created: successes.length,
        results: results.map((r) => ({
          wedding_id: r.input.wedding_id,
          shooter_id: r.input.shooter_id,
          role: r.input.role,
          ...r.result,
        })),
      },
      { status: failures.length > 0 ? 207 : 201 }
    );
  }

  // ── Single assignment mode ──────────────────────────────────────────────────
  const { wedding_id, shooter_id, role, swap_from_wedding_id } = body as SingleAssignBody;

  if (!wedding_id || !shooter_id || !role) {
    return NextResponse.json(
      { error: "Missing required fields: wedding_id, shooter_id, role" },
      { status: 400 }
    );
  }

  if (!isCrewRole(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  const { data: shooterProfile } = await supabase
    .from("shooter_profiles")
    .select("roles")
    .eq("id", shooter_id)
    .single();

  if (!shooterProfile?.roles?.includes(role)) {
    return NextResponse.json(
      { error: "invalid_role", message: "Shooter does not hold this role" },
      { status: 400 }
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("assign_shooter" as never, {
    p_wedding_id: wedding_id,
    p_shooter_id: shooter_id,
    p_role: role,
    p_swap_from_wedding_id: swap_from_wedding_id ?? null,
  });

  if (rpcError) {
    return NextResponse.json({ error: (rpcError as { message: string }).message }, { status: 500 });
  }

  const result = rpcResult as Record<string, unknown> | null;

  if (result?.error === "forbidden") {
    return NextResponse.json({ error: "forbidden", message: "Not authorized" }, { status: 403 });
  }

  if (result?.error === "invalid_role") {
    return NextResponse.json({ error: "invalid_role", message: "Shooter does not hold this role" }, { status: 400 });
  }

  if (result?.error === "blocked") {
    return NextResponse.json({ error: "blocked", message: "Shooter is blocked on this date" }, { status: 409 });
  }

  if (result?.error === "conflict") {
    const conflicting = result.conflicting_wedding as { couple_name?: string } | undefined;
    return NextResponse.json(
      {
        error: "conflict",
        message: `Already assigned to ${conflicting?.couple_name ?? "another wedding"} on this date`,
        conflicting_wedding: result.conflicting_wedding,
      },
      { status: 409 }
    );
  }

  if (result?.error === "stale_conflict") {
    return NextResponse.json(
      { error: "conflict", message: "Stale data — conflicting wedding has changed. Please refresh." },
      { status: 409 }
    );
  }

  if (result?.error === "duplicate") {
    return NextResponse.json({ error: "duplicate", message: "Shooter is already assigned to this wedding" }, { status: 409 });
  }

  if (result?.error === "wedding_not_found") {
    return NextResponse.json({ error: "not_found", message: "Wedding not found" }, { status: 404 });
  }

  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await sendAssignmentEmail(supabase, wedding_id, shooter_id, role);

  return NextResponse.json(
    {
      created: { id: result?.assignment_id, wedding_id, shooter_id, role },
      swapped_from: result?.swapped_from ?? null,
    },
    { status: 201 }
  );
}

// ─── PATCH: change assignment role (with conflict handling) ───────────────────

interface PatchBody {
  assignment_id?: string;
  new_role?: string;
  conflict_action?: "swap" | "remove_other" | "add_to";
  conflict_assignment_id?: string;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assignment_id, new_role, conflict_action, conflict_assignment_id } = body;

  if (!assignment_id || !new_role) {
    return NextResponse.json({ error: "Missing assignment_id or new_role" }, { status: 400 });
  }
  if (!isCrewRole(new_role)) {
    return NextResponse.json({ error: `Invalid role: ${new_role}` }, { status: 400 });
  }
  if (conflict_action && !["swap", "remove_other", "add_to"].includes(conflict_action)) {
    return NextResponse.json({ error: "Invalid conflict_action" }, { status: 400 });
  }
  if ((conflict_action === "swap" || conflict_action === "remove_other") && !conflict_assignment_id) {
    return NextResponse.json(
      { error: "Missing conflict_assignment_id for swap/remove_other" },
      { status: 400 }
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("change_assignment_role" as never, {
    p_assignment_id: assignment_id,
    p_new_role: new_role,
    p_conflict_action: conflict_action ?? null,
    p_conflict_assignment_id: conflict_assignment_id ?? null,
  });

  if (rpcError) {
    return NextResponse.json({ error: (rpcError as { message: string }).message }, { status: 500 });
  }

  const result = rpcResult as Record<string, unknown> | null;

  if (result?.error === "forbidden") return NextResponse.json(result, { status: 403 });
  if (result?.error === "not_found") return NextResponse.json(result, { status: 404 });
  if (result?.error === "invalid_role") return NextResponse.json(result, { status: 400 });
  if (result?.error === "invalid_action") return NextResponse.json(result, { status: 400 });
  if (result?.error === "missing_conflict_assignment_id") return NextResponse.json(result, { status: 400 });
  if (result?.error === "conflict_mismatch") return NextResponse.json(result, { status: 400 });
  if (result?.error === "conflict") return NextResponse.json(result, { status: 409 });
  if (result?.error === "cannot_swap") return NextResponse.json(result, { status: 409 });
  if (result?.error === "conflict_row_gone" || result?.error === "conflict_row_stale") {
    return NextResponse.json(result, { status: 409 });
  }
  if (result?.error) return NextResponse.json(result, { status: 500 });

  return NextResponse.json(result, { status: 200 });
}

// ─── DELETE: remove assignment by id ──────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { assignment_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assignment_id } = body;
  if (!assignment_id) {
    return NextResponse.json({ error: "Missing assignment_id" }, { status: 400 });
  }

  const { error } = await supabase.from("assignments").delete().eq("id", assignment_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
