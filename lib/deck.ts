import { createClient } from "@/lib/supabase/client";

export type Candidate = {
  id: string;
  display_name: string;
  age: number;
  city: string | null;
  bio: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  gym: boolean | null;
  drinks: boolean | null;
  smokes: boolean | null;
  face_verified: boolean;
  wallet_address: string | null;
  wallet_verified: boolean;
  sol_balance: number | null;
  distance_km: number | null;
  photos: string[];
  trades: string[];
};

export async function fetchDeck(limit = 20): Promise<Candidate[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("discover", { limit_n: limit });
  if (error) throw error;
  return (data ?? []) as Candidate[];
}

/**
 * Record a swipe. Returns the match id if this swipe completed a mutual
 * like, otherwise null.
 *
 * The match itself is created by a trigger the moment the second
 * right-swipe lands, so we don't check-then-insert here — that races when
 * two people swipe each other at the same moment, and the loser of the
 * race never learns they matched. We insert, then ask what exists.
 */
export async function swipe(
  meId: string,
  targetId: string,
  direction: "left" | "right" | "super"
): Promise<string | null> {
  const supabase = createClient();

  const { error } = await supabase
    .from("swipes")
    .insert({ swiper_id: meId, target_id: targetId, direction });

  // Duplicate swipe (they double-tapped, or a stale card). Not an error
  // worth showing anyone.
  if (error && !error.message.includes("duplicate")) throw error;

  if (direction === "left") return null;

  const [a, b] = meId < targetId ? [meId, targetId] : [targetId, meId];
  const { data } = await supabase
    .from("matches")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();

  return data?.id ?? null;
}
