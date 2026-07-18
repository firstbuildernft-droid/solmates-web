import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Full account deletion. App Store requires this to exist and to be
// reachable in-app, not just "email us to delete".
//
// Deleting the auth user cascades through every table (profiles ->
// photos/swipes/matches/messages/wallets/...). We clean the storage
// bucket first, since the cascade can't reach files.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();

  // 1. Remove their photos from storage.
  const { data: files } = await admin.storage.from("photos").list(user.id);
  if (files?.length) {
    await admin.storage
      .from("photos")
      .remove(files.map((f) => `${user.id}/${f.name}`));
  }

  // 2. Delete the auth user — cascades to every row keyed on their id.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3. Kill their session on this device.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
