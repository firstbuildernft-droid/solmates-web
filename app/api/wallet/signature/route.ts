import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBalanceSol } from "@/lib/solana";
import { buildMessage, verifySignature } from "@/lib/siws";

// Step two: the wallet signed our message. If the signature checks out
// against the claimed address, they hold that key, so the wallet is theirs.
//
// No payment, no transaction, nothing custodial — the only things that
// ever reach us are a public address and a signature.

const NONCE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { signature } = await request.json();
  if (typeof signature !== "string" || !signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: wallet } = await admin
    .from("wallets")
    .select("address, verify_nonce, nonce_issued_at, state")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!wallet?.verify_nonce || !wallet.nonce_issued_at) {
    return NextResponse.json(
      { error: "Start again — no verification in progress." },
      { status: 400 }
    );
  }

  const age = Date.now() - new Date(wallet.nonce_issued_at).getTime();
  if (age > NONCE_TTL_MS) {
    return NextResponse.json(
      { error: "That took too long. Start again." },
      { status: 400 }
    );
  }

  const message = buildMessage(wallet.address, wallet.verify_nonce);
  if (!verifySignature(message, signature, wallet.address)) {
    return NextResponse.json(
      { error: "That signature doesn't match the wallet." },
      { status: 400 }
    );
  }

  // Burn the nonce as we verify, so the same signature can't be replayed.
  const { error: upErr } = await admin
    .from("wallets")
    .update({
      state: "verified",
      verified_via: "signature",
      verified_at: new Date().toISOString(),
      verify_nonce: null,
      nonce_issued_at: null,
    })
    .eq("user_id", user.id)
    .eq("verify_nonce", wallet.verify_nonce);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Snapshot the balance so the card has a number straight away.
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
    // A missed snapshot isn't worth failing the verification over.
  }

  return NextResponse.json({ ok: true, state: "verified" });
}
