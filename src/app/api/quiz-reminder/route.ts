import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const supabase = await createClient();

    // Find assignments where quiz not passed and wedding is within 48 hours
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const in48hStr = in48h.toISOString().split("T")[0];

    const { data: assignments } = await supabase
      .from("assignments")
      .select(
        "id, role, quiz_passed, shooter_profiles(user_id, name), weddings(date, venue_name, couple_id)"
      )
      .eq("quiz_passed", false);

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sent = 0;

    for (const a of assignments) {
      const wedding = a.weddings as unknown as {
        date: string;
        venue_name: string | null;
        couple_id: string | null;
      };
      if (!wedding || wedding.date < todayStr || wedding.date > in48hStr) continue;

      const profile = a.shooter_profiles as unknown as {
        user_id: string;
        name: string;
      } | null;
      if (!profile) continue;

      // Get shooter email
      const { data: user } = await supabase
        .from("users")
        .select("email")
        .eq("id", profile.user_id)
        .single();
      if (!user?.email) continue;

      // Get couple name
      let coupleName = "your upcoming";
      if (wedding.couple_id) {
        const { data: couple } = await supabase
          .from("couples")
          .select("names")
          .eq("id", wedding.couple_id)
          .single();
        if (couple) coupleName = couple.names;
      }

      const formattedDate = new Date(wedding.date + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "long", month: "long", day: "numeric" }
      );

      const { error } = await resend.emails.send({
        from: "PreWedd Crew <crew@prewedd-mail.com>",
        to: user.email,
        subject: `Quiz reminder: ${coupleName}'s wedding is coming up`,
        html: `
          <h2>Quiz Reminder</h2>
          <p>Hey ${profile.name},</p>
          <p><strong>${coupleName}</strong>'s wedding is on <strong>${formattedDate}</strong> at ${wedding.venue_name || "TBD"}, and you haven't completed the quiz yet.</p>
          <p>Please review the brief and take the quiz before the wedding day.</p>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://crew.prewedd.com"}/dashboard">Open PreWedd Crew</a></p>
        `,
      });

      if (!error) sent++;
    }

    return NextResponse.json({ sent });
  } catch {
    return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 });
  }
}
