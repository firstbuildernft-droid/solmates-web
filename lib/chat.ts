import { createClient } from "@/lib/supabase/client";

export type MatchRow = {
  match_id: string;
  other_id: string;
  other_name: string;
  other_photo: string | null;
  other_face_verified: boolean;
  other_wallet_ok: boolean;
  other_sol: number | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender: string | null;
  unread: number;
  matched_at: string;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export async function fetchMatches(): Promise<MatchRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_matches");
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

export async function fetchMessages(matchId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(matchId: string, senderId: string, body: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markRead(matchId: string, userId: string) {
  const supabase = createClient();
  await supabase.from("match_reads").upsert({
    match_id: matchId,
    user_id: userId,
    last_read_at: new Date().toISOString(),
  });
}

export async function blockUser(blockerId: string, blockedId: string, reason?: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId, reason: reason ?? null });
  if (error) throw error;
}
