import { createClient } from "@/lib/supabase/server";

// TEMPORARY. Delete this folder once the admin panel works.
// It tells you why requireAdmin() is rejecting you, without printing the
// allowed list (so it's safe if someone else stumbles on it — they only
// ever see their own email).

export const dynamic = "force-dynamic";

export default async function WhoAmI() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const raw = process.env.ADMIN_EMAILS;
  const allowed = (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const myEmail = user?.email?.toLowerCase() ?? null;
  const isAdmin = !!myEmail && allowed.includes(myEmail);

  return (
    <main style={{ fontFamily: "system-ui", padding: 28, lineHeight: 1.7, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900 }}>Admin check</h1>

      <p><b>Logged in:</b> {user ? "yes" : "no"}</p>
      <p><b>Your email:</b> {myEmail ?? "(none on this account)"}</p>
      <p><b>ADMIN_EMAILS is set:</b> {raw === undefined ? "NO — variable missing" : "yes"}</p>
      <p><b>Entries in it:</b> {allowed.length}</p>
      <p><b>Length of raw value:</b> {raw?.length ?? 0}</p>
      <p style={{ fontSize: 19, fontWeight: 900, marginTop: 18 }}>
        Match: {isAdmin ? "YES — /bananas should load" : "NO — this is why you get 404"}
      </p>

      <hr style={{ margin: "22px 0" }} />
      <p style={{ fontSize: 13, color: "#666" }}>
        If &quot;ADMIN_EMAILS is set&quot; says NO, the variable is missing from this
        Vercel environment, or it was added without a redeploy.
        If it is set but Match is NO, your account&apos;s email is not the one in
        the list (check for a different address, or an account created by
        phone with no email at all).
      </p>
      <p style={{ fontSize: 13, color: "#666" }}>Delete app/whoami once this is fixed.</p>
    </main>
  );
}
