import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateImage } from "@/lib/moderation";

// Mobile photo upload. Identical moderation to the web /api/photos/upload,
// but authenticated by a Bearer token instead of cookies — the native app
// has no cookie jar, it holds a Supabase access token. Everything else
// (moderate before storage, service-client write, photos row) is the same.

export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Verify the token and learn who it belongs to, using an anon client
  // scoped to this one request's token.
  const sb = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { image, position } = await request.json();
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  const bytes = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), "base64");
  if (bytes.length > 8_000_000) {
    return NextResponse.json({ error: "Image too large." }, { status: 400 });
  }

  const verdict = await moderateImage(bytes);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "rejected", message: "That photo can't be used here. Please choose a different one." },
      { status: 422 }
    );
  }

  const admin = createAdminClient();
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await admin.storage
    .from("photos").upload(path, bytes, { contentType: "image/jpeg" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data, error } = await admin
    .from("photos")
    .insert({ user_id: user.id, storage_path: path, position })
    .select().single();

  if (error) {
    await admin.storage.from("photos").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ photo: data });
}
