// src/app/api/assignment-notify/route.ts
//
// Separate-request notification endpoint for assignment role changes.
// Called by the AssignmentPillPopover AFTER the PATCH /api/assign mutation
// succeeds, only if the admin clicks "Yes" on the notify prompt.
//
// CRITICAL: the server builds the email from DB data. The client passes
// only { assignment_id, action, affected_ids? } — never HTML, never
// recipients. This is the policy distinction from the legacy /api/notify
// route which still accepts raw HTML (see §7b lockdown in the plan).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { buildAssignmentEmail } from "@/lib/utils/notifications";

const resend = new Resend(process.env.RESEND_API_KEY);

type NotifyAction = "role_change" | "swapped";

interface NotifyBody {
  assignment_id?: string;
  action?: NotifyAction | "removed" | string;
  affected_ids?: string[];
}

interface RecipientData {
  email: string;
  shooter_name: string;
  role: string;
  couple_name: string;
  wedding_date: string;
  venue_name: string | null;
}

async function fetchRecipient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string
): Promise<{ data: RecipientData | null; weddingId: string | null }> {
  const { data: assignment } = await supabase
    .from("assignments")
    .select(
      `id, role, wedding_id, shooter_id,
       shooter_profiles(id, name, user_id),
       weddings(id, date, venue_name, couples(names))`
    )
    .eq("id", assignmentId)
    .single();

  if (!assignment) return { data: null, weddingId: null };

  const profile = assignment.shooter_profiles as unknown as
    | { id: string; name: string; user_id: string }
    | null;
  const wedding = assignment.weddings as unknown as
    | { id: string; date: string; venue_name: string | null; couples: { names: string } | null }
    | null;

  if (!profile || !wedding) return { data: null, weddingId: wedding?.id ?? null };

  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", profile.user_id)
    .single();

  if (!user?.email) return { data: null, weddingId: wedding.id };

  return {
    data: {
      email: user.email,
      shooter_name: profile.name,
      role: assignment.role,
      couple_name: wedding.couples?.names ?? "the couple",
      wedding_date: wedding.date,
      venue_name: wedding.venue_name ?? null,
    },
    weddingId: wedding.id,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Rate limit (shared with /api/notify via the same RPC) ──────────────
  const { data: allowed, error: rateError } = await supabase.rpc(
    "check_notify_rate_limit" as never,
    {}
  );
  if (rateError) {
    return NextResponse.json({ error: rateError.message }, { status: 500 });
  }
  if (allowed === false) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: Math.ceil((60_000 - (Date.now() % 60_000)) / 1000),
      },
      { status: 429 }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: NotifyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assignment_id, action, affected_ids } = body;

  if (!assignment_id || !action) {
    return NextResponse.json(
      { error: "Missing assignment_id or action" },
      { status: 400 }
    );
  }

  // Only role_change + swapped are supported. "removed" is intentionally
  // rejected — see plan §7a scope note.
  if (action !== "role_change" && action !== "swapped") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // ── Gather recipients ──────────────────────────────────────────────────
  const recipients: RecipientData[] = [];

  const primary = await fetchRecipient(supabase, assignment_id);
  if (!primary.data) {
    return NextResponse.json(
      { error: "assignment_not_found_or_no_email" },
      { status: 404 }
    );
  }
  recipients.push(primary.data);

  if (action === "swapped") {
    const secondaryId = affected_ids?.[0];
    if (!secondaryId) {
      return NextResponse.json(
        { error: "missing_affected_ids", message: "swapped requires affected_ids[0]" },
        { status: 400 }
      );
    }
    const secondary = await fetchRecipient(supabase, secondaryId);
    if (!secondary.data) {
      return NextResponse.json(
        { error: "invalid_swap_target" },
        { status: 400 }
      );
    }
    if (secondary.weddingId !== primary.weddingId) {
      return NextResponse.json(
        { error: "invalid_swap_target", message: "affected_ids must be on the same wedding" },
        { status: 400 }
      );
    }
    recipients.push(secondary.data);
  }

  // ── Send emails (best-effort, track failures per recipient) ────────────
  const failedRecipients: string[] = [];
  let sent = 0;

  for (const r of recipients) {
    const email = buildAssignmentEmail({
      shooterEmail: r.email,
      shooterName: r.shooter_name,
      coupleName: r.couple_name,
      weddingDate: r.wedding_date,
      venueName: r.venue_name,
      role: r.role,
    });
    try {
      const { error } = await resend.emails.send({
        from: "PreWedd Crew <crew@prewedd-mail.com>",
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
      if (error) {
        console.error("[assignment-notify] resend error for", r.email, error);
        failedRecipients.push(r.email);
      } else {
        sent++;
      }
    } catch (err) {
      console.error("[assignment-notify] send exception for", r.email, err);
      failedRecipients.push(r.email);
    }
  }

  const failed = failedRecipients.length;
  const status = sent === 0 ? 500 : 200;

  return NextResponse.json(
    { ok: sent > 0, sent, failed, failed_recipients: failedRecipients },
    { status }
  );
}
