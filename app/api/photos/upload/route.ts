import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateImage } from "@/lib/moderation";

// The upload now goes through the server so the image is checked BEFORE it
// touches storage. A rejected image is never written anywhere. This is the
// whole reason moderation can't live in the browser — a client check is a
// suggestion, this is a wall.

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { image, position } = await request.json();
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  const bytes = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), "base64");

  // Rough size ceiling — the browser already shrinks to 1200px, so a
  // payload much bigger than this is either abuse or a bug.
  if (bytes.length > 8_000_000) {
    return NextResponse.json({ error: "Image too large." }, { status: 400 });
  }

  // THE CHECK. Before storage, before the DB row.
  const verdict = await moderateImage(bytes);
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        error: "rejected",
        message:
          "That photo can't be used here. Please choose a different one.",
        // category/confidence intentionally NOT sent to the client — no
        // reason to tell someone exactly which detector they tripped.
      },
      { status: 422 }
    );
  }

  // Clean — upload with the service client (bypasses nothing important;
  // the RLS storage policy still keys on the path, which we control here).
  const admin = createAdminClient();
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await admin.storage
    .from("photos")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("photos")
    .insert({ user_id: user.id, storage_path: path, position })
    .select()
    .single();

  if (error) {
    await admin.storage.from("photos").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ photo: data });
}
