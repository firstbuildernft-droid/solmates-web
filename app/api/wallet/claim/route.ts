import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looksLikeAddress } from "@/lib/solana";

// Step one of verification: user tells us which wallet is theirs.
// We believe nothing yet — we just record the claim.

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

  // One wallet, one profile. This is the anti-sybil check, and it has to
  // happen here rather than in the UI — the UI is just a suggestion.
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

  const { error } = await admin.from("wallets").upsert(
    {
      user_id: user.id,
      address,
      state: "pending",
      deposit_addr: process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS!,
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
