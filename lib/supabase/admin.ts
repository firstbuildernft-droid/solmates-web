import "server-only";
import { createClient } from "@supabase/supabase-js";

// The service role key ignores every RLS policy in the schema.
// The "server-only" import above makes the build FAIL if any client
// component ever imports this file, which is the cheapest possible
// insurance against the worst possible mistake.
//
// Only used where a user must not be trusted to write for themselves:
// flipping wallets.state to 'verified' is exactly that case.

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
