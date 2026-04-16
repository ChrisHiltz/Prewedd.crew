// src/app/api/notify/route.ts
//
// Legacy raw-email route. Originally accepted unauthenticated { to, subject,
// html } from any caller — a real abuse vector for sending mail from our
// verified Resend domain. Stage 2 lockdown adds:
//   1. requireAdmin gate (403 for non-admins)
//   2. Shared DB-backed rate limit (30 sends/minute per admin, fixed UTC
//      bucket — see check_notify_rate_limit RPC)
//
// Tech debt: this route still accepts client-composed HTML. The brief
// publish flow at src/app/admin/weddings/[id]/brief/page.tsx:217 still
// posts raw HTML through here. A Stage 3 follow-up should introduce
// /api/brief-publish-notify (server-built from { wedding_id }) and
// delete this route entirely.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Rate limit (shared bucket with /api/assignment-notify) ─────────────
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

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return NextResponse.json(
      { error: "Missing required fields: to, subject, html" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "PreWedd Crew <crew@prewedd-mail.com>",
      to,
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
