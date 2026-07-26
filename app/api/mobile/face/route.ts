import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { compareToPhotos } from "@/lib/face";

// Mobile face verification. Same flow as /api/face/verify, but Bearer-token
// authed (the phone has no cookies). The selfie is compared and discarded
// when the request ends — nothing writes the image anywhere.

const DAILY_LIMIT = 2;
export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const sb = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles").select("face_verified").eq("id", user.id).maybeSingle();
  if (profile?.face_verified) {
    return NextResponse.json({ passed: true, alreadyVerified: true });
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("face_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "limit", message: "You've used both tries for today. Try again tomorrow in good light." },
      { status: 429 }
    );
  }

  const { selfie } = await request.json();
  if (!selfie || typeof selfie !== "string") {
    return NextResponse.json({ error: "No selfie provided." }, { status: 400 });
  }

  const { data: photos } = await admin
    .from("photos").select("storage_path").eq("user_id", user.id).order("position");

  if (!photos?.length) {
    await admin.from("face_attempts").insert({ user_id: user.id, passed: false, reason: "no_photos" });
    return NextResponse.json(
      { error: "no_photos", message: "Add at least one profile photo first." },
      { status: 400 }
    );
  }

  const selfieBuf = Buffer.from(selfie.replace(/^data:image\/\w+;base64,/, ""), "base64");

  const photoBuffers: Buffer[] = [];
  for (const p of photos) {
    const { data } = await admin.storage.from("photos").download(p.storage_path);
    if (data) photoBuffers.push(Buffer.from(await data.arrayBuffer()));
  }

  const result = await compareToPhotos(selfieBuf, photoBuffers);

  await admin.from("face_attempts").insert({
    user_id: user.id,
    passed: result.passed,
    similarity: result.similarity,
    reason: result.reason,
  });

  if (result.passed) {
    await admin
      .from("profiles")
      .update({ face_verified: true, face_verified_at: new Date().toISOString() })
      .eq("id", user.id);
    return NextResponse.json({ passed: true, similarity: result.similarity });
  }

  const left = Math.max(0, DAILY_LIMIT - (count ?? 0) - 1);
  const messages: Record<string, string> = {
    no_face: "We couldn't find a face. Look straight at the camera in good light.",
    multiple_faces: "Make sure it's just you in the frame.",
    no_match: "That didn't match your profile photos. Make sure it's really you.",
    error: "Something went wrong on our end. Please try again.",
  };

  return NextResponse.json({
    passed: false,
    reason: result.reason,
    message: messages[result.reason] ?? "Verification failed.",
    attemptsLeft: left,
  });
}
