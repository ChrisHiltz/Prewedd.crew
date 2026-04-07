// src/lib/utils/notifications.ts
// Shared email template builder for assignment notifications.
// /api/assign imports buildAssignmentEmail and calls Resend directly.
// Emails are ONLY sent after successful DB commit — never optimistically.

import { ROLE_LABELS } from "@/lib/utils/roles";

export interface AssignmentEmailPayload {
  shooterEmail: string;
  shooterName: string;
  coupleName: string;    // from couples.names, e.g. "Austin & JJ"
  weddingDate: string;   // ISO date string YYYY-MM-DD
  venueName: string | null;
  role: string;
}

export interface BuiltEmail {
  to: string;
  subject: string;
  html: string;
}

export function buildAssignmentEmail(payload: AssignmentEmailPayload): BuiltEmail {
  const { shooterEmail, shooterName, coupleName, weddingDate, venueName, role } = payload;

  const formattedDate = new Date(weddingDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
  const venueDisplay = venueName ?? "TBD";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prewedd-crew.vercel.app";

  return {
    to: shooterEmail,
    subject: `You've been assigned to ${coupleName}'s wedding`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #1B3A5C;">New Wedding Assignment</h2>
        <p>Hi ${shooterName},</p>
        <p>You've been assigned as <strong>${roleLabel}</strong> for <strong>${coupleName}</strong>'s wedding.</p>
        <ul>
          <li><strong>Date:</strong> ${formattedDate}</li>
          <li><strong>Venue:</strong> ${venueDisplay}</li>
          <li><strong>Your role:</strong> ${roleLabel}</li>
        </ul>
        <p>
          <a href="${appUrl}/dashboard" style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in PreWedd Crew
          </a>
        </p>
        <p style="color: #888; font-size: 12px;">PreWedd Crew — TLIC Team Platform</p>
      </div>
    `,
  };
}
