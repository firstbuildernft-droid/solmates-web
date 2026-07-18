import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDeposit, getBalanceSol, rpcHost } from "@/lib/solana";

const MIN_SOL = Number(process.env.VERIFY_MIN_SOL ?? "0.1");
const THROTTLE_MS = 6000;

// The "I've sent it" button lands here.
// We ask the chain a question and answer straight away. No cron, no queue.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();

  const { data: wallet } = await admin
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json({ error: "No wallet claimed yet." }, { status: 400 });
  }
  if (wallet.state === "verified") {
    return NextResponse.json({ state: "verified" });
  }

  // Each check costs us up to ~26 RPC calls. Without this, one bored
  // person with a keyboard burns through the RPC quota for everybody.
  if (
    wallet.last_checked_at &&
    Date.now() - new Date(wallet.last_checked_at).getTime() < THROTTLE_MS
  ) {
    return NextResponse.json(
      { error: "Give it a few seconds and try again." },
      { status: 429 }
    );
  }

  await admin
    .from("wallets")
    .update({
      last_checked_at: new Date().toISOString(),
      check_count: (wallet.check_count ?? 0) + 1,
    })
    .eq("user_id", user.id);

  let sig: string | null;
  let scanned = 0;
  try {
    const res = await findDeposit(
      wallet.address,
      process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS!,
      MIN_SOL
    );
    sig = res.signature;
    scanned = res.scanned;
  } catch {
    // RPC had a bad moment. Explicitly NOT a rejection — telling someone
    // who just paid that we can't find their money is the worst possible
    // wrong answer.
    return NextResponse.json(
      { error: "Couldn't reach Solana just now. Try again in a moment." },
      { status: 503 }
    );
  }

  if (!sig) {
    // Temporary diagnostics. scanned = 0 means this wallet has no
    // transactions on the network we're pointed at -- almost always the
    // wrong network, not a missing payment.
    return NextResponse.json({
      state: "pending",
      found: false,
      scanned,
      rpc: rpcHost(),
      lookingFor: `${MIN_SOL} SOL from ${wallet.address.slice(0, 6)} to ${(
        process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS ?? "MISSING"
      ).slice(0, 6)}`,
    });
  }

  // tx_sig is UNIQUE on payments. If this transaction was already used to
  // verify some other account, this insert fails and nothing gets marked
  // verified — that's the replay check doing its job, in the database,
  // where it can't be forgotten.
  const { error: payErr } = await admin.from("payments").insert({
    user_id: user.id,
    kind: "verification_deposit",
    amount_sol: MIN_SOL,
    tx_sig: sig,
    state: "confirmed",
  });

  if (payErr) {
    return NextResponse.json(
      { error: "That transaction has already been used." },
      { status: 409 }
    );
  }

  await admin
    .from("wallets")
    .update({
      state: "verified",
      verified_at: new Date().toISOString(),
      verify_tx_sig: sig,
    })
    .eq("user_id", user.id);

  // Snapshot the balance while we're here. Day one of the history that
  // "up 34% this month" will eventually be computed from.
  try {
    const sol = await getBalanceSol(wallet.address);
    await admin.from("wallet_balances").upsert({
      address: wallet.address,
      sol_balance: sol,
      updated_at: new Date().toISOString(),
    });
    await admin
      .from("wallet_balance_snapshots")
      .upsert({ address: wallet.address, sol_balance: sol });
  } catch {
    // Balance is a nice-to-have. Never fail a verification over it —
    // they paid, they're verified, the number can arrive later.
  }

  return NextResponse.json({ state: "verified", signature: sig });
}
