import { createClient } from "@/lib/supabase/client";

// Ask the browser for GPS. Resolves with coords, or null if the user
// denies / it's unavailable. Never throws — a denied prompt is a normal
// outcome, not an error.
export function getBrowserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // denied or failed — fall back to IP server-side
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

// Store it. The RPC fuzzes before saving; the raw coords never persist.
// We also reverse-geocode to a city name so the profile can show it.
export async function saveLocation(lat: number, lng: number) {
  const supabase = createClient();
  await supabase.rpc("set_location", { raw_lat: lat, raw_lng: lng });

  // Turn coords into a city name (free, no key). Best-effort — if it
  // fails, the location still saved, we just won't have a fresh city.
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const a = data.address ?? {};
    const city =
      a.city || a.town || a.village || a.county || a.state || a.province || null;
    if (city) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ city }).eq("id", user.id);
    }
  } catch {
    /* geocode is best-effort — the location itself already saved */
  }
}

// One call: try GPS, and if we got it, store it. Returns whether we got a
// real fix (so the UI can decide whether to fall back to IP).
export async function captureLocation(): Promise<boolean> {
  const coords = await getBrowserLocation();
  if (!coords) return false;
  await saveLocation(coords.lat, coords.lng);
  return true;
}

// Refresh silently on app open if the stored location is stale. Called
// from the deck. Won't re-prompt if permission was already granted;
// browsers remember the grant. If it was denied, this quietly no-ops.
export async function refreshLocationIfStale() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("profiles")
    .select("location_updated_at")
    .eq("id", user.id)
    .maybeSingle();

  const last = data?.location_updated_at
    ? new Date(data.location_updated_at).getTime()
    : 0;
  // refresh at most once every 6h
  if (Date.now() - last < 6 * 3600 * 1000) return;

  // navigator.permissions may not exist everywhere; guard it.
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (perm && perm.state === "denied") return; // don't nag
  } catch {
    /* ignore — we'll just try */
  }

  await captureLocation();
}

// The user's OWN stored (fuzzed) coordinates, for showing them their map.
// These are already jittered — even the owner only sees the approximate
// point, which is fine, and means there's no exact coordinate anywhere on
// the client.
export async function getMyLocation(): Promise<{
  lat: number | null;
  lng: number | null;
  city: string | null;
  has: boolean;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { lat: null, lng: null, city: null, has: false };

  const { data } = await supabase
    .from("profiles")
    .select("lat, lng, city")
    .eq("id", user.id)
    .maybeSingle();

  return {
    lat: data?.lat ?? null,
    lng: data?.lng ?? null,
    city: data?.city ?? null,
    has: data?.lat != null && data?.lng != null,
  };
}

// Does the browser currently have location permission granted?
export async function locationPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return (p?.state as "granted" | "denied" | "prompt") ?? "unknown";
  } catch {
    return "unknown";
  }
}
