import "server-only";
import { createClient } from "@/lib/supabase/server";

// Who can see the admin pages.
// Comma-separated emails in ADMIN_EMAILS. No NEXT_PUBLIC_ prefix, so the
// list never reaches the browser.
//
// This is deliberately dumb. A proper roles table is the right answer
// once there's more than one of you — but a roles table you got subtly
// wrong is worse than an env var you can read at a glance.

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!user?.email || !allowed.includes(user.email.toLowerCase())) {
    return null;
  }
  return user;
}

// Monday of the week containing `d`.
export function weekStart(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}
