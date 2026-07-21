import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Every signed-up user with their key profile data and a simple lifetime
// activity score. This is the admin "who's on the app" view — distinct
// from weeklyActivity (which is women-only, this-week-only, for payouts).
//
// Aggregates in JS, same reasoning as activity.ts: right at your size,
// move to SQL when the page gets slow.

export type UserRow = {
  id: string;
  name: string;
  gender: string | null;
  city: string | null;
  age: number | null;
  joined: string | null;
  onboarded: boolean;
  faceVerified: boolean;
  walletVerified: boolean;
  walletAddress: string | null;
  sol: number | null;
  photos: number;
  // activity
  likesGiven: number;
  likesReceived: number;
  matches: number;
  messagesSent: number;
  score: number;
};

export async function allUsers(): Promise<UserRow[]> {
  const admin = createAdminClient();

  const [
    { data: profiles },
    { data: swipes },
    { data: msgs },
    { data: matches },
    { data: wallets },
    { data: balances },
    { data: photos },
  ] = await Promise.all([
    admin.from("profiles").select("id, display_name, gender, city, birthdate, onboarded, face_verified, created_at"),
    admin.from("swipes").select("swiper_id, target_id, direction"),
    admin.from("messages").select("sender_id"),
    admin.from("matches").select("user_a, user_b"),
    admin.from("wallets").select("user_id, address, state"),
    admin.from("wallet_balances").select("address, sol_balance"),
    admin.from("photos").select("user_id"),
  ]);

  // Index the supporting data by user.
  const likesGiven = new Map<string, number>();
  const likesReceived = new Map<string, number>();
  for (const s of swipes ?? []) {
    if (s.direction !== "left") {
      likesGiven.set(s.swiper_id, (likesGiven.get(s.swiper_id) ?? 0) + 1);
      likesReceived.set(s.target_id, (likesReceived.get(s.target_id) ?? 0) + 1);
    }
  }

  const msgsSent = new Map<string, number>();
  for (const m of msgs ?? []) msgsSent.set(m.sender_id, (msgsSent.get(m.sender_id) ?? 0) + 1);

  const matchCount = new Map<string, number>();
  for (const m of matches ?? []) {
    matchCount.set(m.user_a, (matchCount.get(m.user_a) ?? 0) + 1);
    matchCount.set(m.user_b, (matchCount.get(m.user_b) ?? 0) + 1);
  }

  const balByAddr = new Map<string, number>();
  for (const b of balances ?? []) balByAddr.set(b.address, Number(b.sol_balance));

  const walletByUser = new Map<string, { address: string; state: string }>();
  for (const w of wallets ?? []) walletByUser.set(w.user_id, { address: w.address, state: w.state });

  const photoCount = new Map<string, number>();
  for (const p of photos ?? []) photoCount.set(p.user_id, (photoCount.get(p.user_id) ?? 0) + 1);

  const rows: UserRow[] = (profiles ?? []).map((p) => {
    const w = walletByUser.get(p.id);
    const walletVerified = w?.state === "verified";
    const sol = walletVerified && w ? balByAddr.get(w.address) ?? null : null;
    const age = p.birthdate
      ? Math.floor((Date.now() - new Date(p.birthdate).getTime()) / 3.15576e10)
      : null;

    const lg = likesGiven.get(p.id) ?? 0;
    const lr = likesReceived.get(p.id) ?? 0;
    const mt = matchCount.get(p.id) ?? 0;
    const ms = msgsSent.get(p.id) ?? 0;

    // Simple engagement score — weighted toward two-way activity. Tune freely.
    const score = lg * 1 + lr * 1 + mt * 4 + ms * 2;

    return {
      id: p.id,
      name: p.display_name ?? "—",
      gender: p.gender ?? null,
      city: p.city ?? null,
      age,
      joined: p.created_at ?? null,
      onboarded: !!p.onboarded,
      faceVerified: !!p.face_verified,
      walletVerified,
      walletAddress: w?.address ?? null,
      sol,
      photos: photoCount.get(p.id) ?? 0,
      likesGiven: lg,
      likesReceived: lr,
      matches: mt,
      messagesSent: ms,
      score,
    };
  });

  // Most active first.
  rows.sort((a, b) => b.score - a.score);
  return rows;
}
