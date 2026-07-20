"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/Card";
import { PreviewSkeleton } from "@/components/Skeletons";
import type { Candidate } from "@/lib/deck";
import { GREEN, INK, MUTE, font } from "@/lib/theme";

// "How others see you." Builds a Candidate from your own data and renders
// the SAME Card component the swipe deck uses — so this is exactly what a
// match sees, not an approximation.
//
// Location note: the deck shows OTHERS a fuzzed "X km away". Here it's
// YOUR card, so there's no distance to show (distance is always relative
// to the viewer). We show your city instead, and a line making clear that
// others see distance, not your city.

export default function PreviewPage() {
  const router = useRouter();
  const [card, setCard] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPhotos, setNoPhotos] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const [{ data: p }, { data: photos }, { data: trades }, { data: wallet }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase
            .from("photos")
            .select("storage_path")
            .eq("user_id", user.id)
            .order("position"),
          supabase
            .from("trades")
            .select("label")
            .eq("user_id", user.id)
            .order("position"),
          supabase
            .from("wallets")
            .select("address, state")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (!p) return router.replace("/onboarding");

      const photoPaths = (photos ?? []).map((x) => x.storage_path);
      if (photoPaths.length === 0) {
        setNoPhotos(true);
        setLoading(false);
        return;
      }

      let sol: number | null = null;
      const walletOk = wallet?.state === "verified";
      if (walletOk && wallet?.address) {
        const { data: bal } = await supabase
          .from("wallet_balances")
          .select("sol_balance")
          .eq("address", wallet.address)
          .maybeSingle();
        sol = bal?.sol_balance ?? null;
      }

      const age =
        p.birthdate
          ? Math.floor(
              (Date.now() - new Date(p.birthdate).getTime()) / 3.15576e10
            )
          : 0;

      setCard({
        id: p.id,
        display_name: p.display_name,
        age,
        city: p.city,
        bio: p.bio,
        height_cm: p.height_cm,
        weight_kg: p.weight_kg,
        gym: p.gym,
        drinks: p.drinks,
        smokes: p.smokes,
        face_verified: p.face_verified,
        wallet_address: walletOk ? wallet?.address ?? null : null,
        wallet_verified: walletOk,
        sol_balance: sol,
        photos: photoPaths,
        trades: (trades ?? []).map((t) => t.label),
        distance_km: null, // your own card has no distance
        prompt_qs: [],
        prompt_as: [],
      });
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <PreviewSkeleton />;

  return (
    <main
      style={{
        minHeight: "100dvh",
        fontFamily: font,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        maxWidth: 430,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px" }}>
        <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <ChevronLeft size={26} color={INK} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Eye size={18} color={GREEN} />
          <h1 style={{ fontWeight: 900, fontSize: 19, color: INK, margin: 0 }}>Preview</h1>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 12.5, color: MUTE, padding: "0 24px 12px", lineHeight: 1.5 }}>
        This is how your card looks to others. They see your distance
        (&ldquo;3 km away&rdquo;), never your exact location.
      </div>

      {noPhotos ? (
        <div style={{ textAlign: "center", color: MUTE, fontSize: 14, padding: "60px 30px", lineHeight: 1.6 }}>
          Add at least one photo to see your preview.
          <br />
          <button
            onClick={() => router.push("/profile")}
            style={{ marginTop: 18, background: GREEN, color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px", fontWeight: 800, fontSize: 14, fontFamily: font, cursor: "pointer" }}
          >
            Add photos
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, position: "relative", margin: "0 16px 24px", minHeight: 520 }}>
          {card && <Card p={card} isTop={false} dragOffset={0} style={{ transform: "none" }} />}
        </div>
      )}
    </main>
  );
}
