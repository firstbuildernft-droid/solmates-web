import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looksLikeAddress } from "@/lib/solana";
import { buildMessage } from "@/lib/siws";

// Step one of signature verification: hand out a one-time nonce and the
// exact message the wallet will be asked to sign.
//
// Nothing is trusted yet. The address is only a claim until the signature
// comes back and checks out.

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { address } = await request.json();
  if (!looksLikeAddress(address ?? "")) {
    return NextResponse.json(
      { error: "That doesn't look like a Solana address." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // One wallet, one profile.
  const { data: taken } = await admin
    .from("wallets")
    .select("user_id")
    .eq("address", address)
    .maybeSingle();

  if (taken && taken.user_id !== user.id) {
    return NextResponse.json(
      { error: "That wallet is already linked to another profile." },
      { status: 409 }
    );
  }

  const nonce = randomUUID();

  const { error } = await admin.from("wallets").upsert(
    {
      user_id: user.id,
      address,
      state: "pending",
      verified_via: "signature",
      verify_nonce: nonce,
      nonce_issued_at: new Date().toISOString(),
      deposit_addr: process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS ?? "",
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: buildMessage(address, nonce) });
}
