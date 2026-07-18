"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, weekStart } from "@/lib/admin";

// You send the SOL by hand from your wallet. This just records that you
// did it, so next week's list knows and you don't pay twice.
//
// The $50 cap is a CHECK constraint on reward_weeks — if a number is ever
// wrong, the database refuses the row rather than trusting this file.

export async function markPaid(userId: string, amountUsd: number, txSig: string) {
  const admin_user = await requireAdmin();
  if (!admin_user) return { error: "Not allowed." };

  if (!(amountUsd > 0 && amountUsd <= 50)) {
    return { error: "Amount must be between $0 and $50." };
  }
  if (!txSig.trim()) {
    return { error: "Paste the transaction signature so there's a record." };
  }

  const admin = createAdminClient();
  const week = weekStart();

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      kind: "reward_payout",
      amount_sol: 0, // you paid in SOL; record the real amount if you track it
      tx_sig: txSig.trim(),
      state: "confirmed",
    })
    .select("id")
    .single();

  // tx_sig is UNIQUE — this fires if you paste the same signature twice,
  // which is the exact mistake worth catching at 1am on a Sunday.
  if (payErr) return { error: "That transaction is already recorded." };

  const { error } = await admin.from("reward_weeks").upsert({
    user_id: userId,
    week_start: week,
    amount_usd: amountUsd,
    payment_id: payment.id,
    paid_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
