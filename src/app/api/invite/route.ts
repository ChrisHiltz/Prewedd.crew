// src/app/api/invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────

interface InviteBody {
  email: string;
  role: "shooter" | "admin";
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

// ─── Email builders ────────────────────────────────────────────────────────────

function buildShooterWelcomeEmail(email: string): { to: string; subject: string; html: string } {
  return {
    to: email,
    subject: "Welcome to the TLIC team! Here's what's next",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
  <div style="background: white; border-radius: 12px; padding: 32px 24px; border: 1px solid #e8d0d8;">
    <h2 style="font-size: 22px; color: #2e1a23; margin: 0 0 16px;">Welcome to the TLIC crew!</h2>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 12px;">You've been invited to join the PreWedd Crew team portal — the hub for your wedding assignments, couple briefs, schedule, and day-of prep.</p>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 12px;">Here's what to expect:</p>
    <ul style="font-size: 14px; color: #6b5660; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
      <li><strong style="color: #2e1a23;">Sign in with a magic link</strong> — check your email for a separate sign-in link, or go to the login page below. No passwords, ever.</li>
      <li><strong style="color: #2e1a23;">Complete onboarding</strong> — set up your profile, add your roles and rates, and finish the skills assessment.</li>
      <li><strong style="color: #2e1a23;">Manage your availability</strong> — block dates you're unavailable so the calendar stays accurate.</li>
      <li><strong style="color: #2e1a23;">Get wedding assignments</strong> — you'll see the couple, venue, and your role for each shoot.</li>
      <li><strong style="color: #2e1a23;">Review briefs and take the quiz</strong> — prep for each wedding with couple-specific info and a short readiness check.</li>
    </ul>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 24px;">Ready to get started? Tap the button below to go to the login page.</p>
    <a href="https://prewedd-crew.vercel.app/login" style="display: inline-block; background: #1B3A5C; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 0 0 24px;">Go to PreWedd Crew</a>
    <p style="font-size: 14px; color: #9b8890; margin: 0;">Excited to have you on the team!</p>
    <p style="font-size: 14px; color: #2e1a23; font-weight: 600; margin: 4px 0 0;">— The TLIC Team</p>
  </div>
</div>`,
  };
}

function buildAdminWelcomeEmail(email: string): { to: string; subject: string; html: string } {
  return {
    to: email,
    subject: "PreWedd Crew — You have admin access!",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
  <div style="background: white; border-radius: 12px; padding: 32px 24px; border: 1px solid #e8d0d8;">
    <h2 style="font-size: 22px; color: #2e1a23; margin: 0 0 16px;">You have admin access to PreWedd Crew</h2>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 12px;">You've been granted admin access to the PreWedd Crew team operations platform. From here you can manage the shooter roster, schedule weddings, build couple briefs, and track assignment readiness.</p>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 12px;">A few things to explore:</p>
    <ul style="font-size: 14px; color: #6b5660; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
      <li><strong style="color: #2e1a23;">Calendar tab</strong> — master availability view, assign shooters to weddings from a single screen.</li>
      <li><strong style="color: #2e1a23;">Roster tab</strong> — view and edit shooter profiles, invite new team members.</li>
      <li><strong style="color: #2e1a23;">Weddings tab</strong> — create and manage wedding records, build couple briefs.</li>
    </ul>
    <p style="font-size: 15px; color: #6b5660; line-height: 1.6; margin: 0 0 24px;">To sign in, go to the login page and enter your email — you'll receive a magic link. No password needed.</p>
    <a href="https://prewedd-crew.vercel.app/login" style="display: inline-block; background: #1B3A5C; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 0 0 24px;">Go to PreWedd Crew</a>
    <p style="font-size: 14px; color: #9b8890; margin: 0;">Questions? Just reply to this email.</p>
    <p style="font-size: 14px; color: #2e1a23; font-weight: 600; margin: 4px 0 0;">— The TLIC Team</p>
  </div>
</div>`,
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const adminId = await requireAdmin(supabase);
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, role } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (role !== "shooter" && role !== "admin") {
    return NextResponse.json({ error: "Role must be 'shooter' or 'admin'" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists in public.users
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, role")
    .eq("email", normalizedEmail)
    .single();

  if (existingUser) {
    // User exists — update their role directly
    const { error: updateError } = await supabase
      .from("users")
      .update({ role })
      .eq("id", existingUser.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    // New user — insert into pending_invites then send OTP
    const { error: insertError } = await supabase
      .from("pending_invites")
      .upsert({ email: normalizedEmail, role }, { onConflict: "email" });

    if (insertError) {
      console.error("[api/invite] pending_invites insert failed:", insertError);
      // Non-fatal: continue and still send the OTP + welcome email
    }

    try {
      await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `https://prewedd-crew.vercel.app/auth/callback?next=${role === "admin" ? "/admin/calendar" : "/dashboard"}`,
        },
      });
    } catch (otpErr) {
      console.error("[api/invite] OTP send failed:", otpErr);
      // Non-fatal: welcome email tells them to use the login page
    }
  }

  // Send welcome email (best-effort)
  try {
    const emailPayload =
      role === "admin"
        ? buildAdminWelcomeEmail(normalizedEmail)
        : buildShooterWelcomeEmail(normalizedEmail);

    await resend.emails.send({
      from: "PreWedd Crew <crew@prewedd-mail.com>",
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
    });
  } catch (emailErr) {
    console.error("[api/invite] welcome email send failed:", emailErr);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
