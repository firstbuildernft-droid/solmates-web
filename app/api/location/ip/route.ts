import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fallback for users who deny GPS. Vercel hands us rough geo from the
// request headers — city-level, often tens of km off, but enough to seed
// a location so the deck isn't empty and "nearish" ordering works.
//
// This is deliberately coarse. It is NOT a substitute for GPS and we
// don't pretend it is — but "roughly your city" beats "no location".

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Vercel sets these on the request. Locally they're absent — that's fine.
  const lat = request.headers.get("x-vercel-ip-latitude");
  const lng = request.headers.get("x-vercel-ip-longitude");
  const city = request.headers.get("x-vercel-ip-city");

  if (!lat || !lng) {
    return NextResponse.json({ ok: false, reason: "no_ip_geo" });
  }

  const admin = createAdminClient();

  // Round hard — IP geo is coarse anyway, and we never want precision here.
  await admin
    .from("profiles")
    .update({
      lat: Math.round(parseFloat(lat) * 100) / 100,
      lng: Math.round(parseFloat(lng) * 100) / 100,
      location_updated_at: new Date().toISOString(),
      ...(city ? { city: decodeURIComponent(city) } : {}),
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, approximate: true });
}
