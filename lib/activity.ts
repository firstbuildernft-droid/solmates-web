import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekStart } from "@/lib/admin";

// Weekly activity for women, for the manual payout.
//
// Scope note: this pulls the week's raw rows and aggregates in JS. That's
// the right call at your size and the wrong call at 50k users — at that
// point it moves into SQL. It'll be obvious when: the page gets slow.
//
// The score is a starting point, not gospel. You'll want to look at the
// component numbers and the profile before sending anyone money — which
// is exactly why the table shows the components and not just a total.

export type ActivityRow = {
  userId: string;
  name: string;
  city: string | null;
  likesReceived: number;
  swipesOnHer: number;
  likeRate: number; // share of men who swiped right on her
  messagesSent: number;
  messagesReceived: number;
  matches: number;
  score: number;
  suggestedUsd: number;
  alreadyPaid: boolean;
};

export async function weeklyActivity(): Promise<{
  week: string;
  rows: ActivityRow[];
}> {
  const admin = createAdminClient();
  const week = weekStart();
  const since = new Date(week).toISOString();

  const [{ data: women }, { data: swipes }, { data: msgs }, { data: matches }, { data: paid }] =
    await Promise.all([
      admin.from("profiles").select("id, display_name, city").eq("gender", "woman"),
      admin.from("swipes").select("swiper_id, target_id, direction").gte("created_at", since),
      admin.from("messages").select("sender_id, match_id").gte("created_at", since),
      admin.from("matches").select("id, user_a, user_b").gte("created_at", since),
      admin.from("reward_weeks").select("user_id").eq("week_start", week),
    ]);

  const paidSet = new Set((paid ?? []).map((p) => p.user_id));

  // match_id -> the two members, so we can attribute received messages
  const members = new Map<string, [string, string]>();
  for (const m of matches ?? []) members.set(m.id, [m.user_a, m.user_b]);

  const rows: ActivityRow[] = (women ?? []).map((w) => {
    const onHer = (swipes ?? []).filter((s) => s.target_id === w.id);
    const likes = onHer.filter((s) => s.direction !== "left").length;
    const likeRate = onHer.length ? likes / onHer.length : 0;

    const sent = (msgs ?? []).filter((m) => m.sender_id === w.id).length;

    const received = (msgs ?? []).filter((m) => {
      if (m.sender_id === w.id) return false;
      const pair = members.get(m.match_id);
      return pair ? pair.includes(w.id) : false;
    }).length;

    const matchCount = (matches ?? []).filter(
      (m) => m.user_a === w.id || m.user_b === w.id
    ).length;

    // Weighted toward conversation over popularity. Getting liked a lot is
    // passive — you're paying for activity that keeps men on the app, and
    // that's messages, not looks. Messages RECEIVED is the closest honest
    // proxy for "men are enjoying this" that doesn't require asking them.
    const score =
      likes * 1 + likeRate * 20 + sent * 2 + received * 3 + matchCount * 4;

    return {
      userId: w.id,
      name: w.display_name,
      city: w.city,
      likesReceived: likes,
      swipesOnHer: onHer.length,
      likeRate,
      messagesSent: sent,
      messagesReceived: received,
      matches: matchCount,
      score: Math.round(score * 10) / 10,
      suggestedUsd: 0, // filled in below, once we know the top score
      alreadyPaid: paidSet.has(w.id),
    };
  });

  rows.sort((a, b) => b.score - a.score);

  // Scale against the week's best performer, capped at $50 — the same cap
  // the database enforces, so a bug here can't overpay.
  const top = rows[0]?.score ?? 0;
  for (const r of rows) {
    r.suggestedUsd = top > 0 ? Math.round((r.score / top) * 50) : 0;
  }

  return { week, rows: rows.filter((r) => r.score > 0) };
}
