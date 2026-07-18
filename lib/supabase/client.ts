import { createBrowserClient } from "@supabase/ssr";

// Use this in any component with "use client" at the top.
// Safe to expose — the anon key can only do what your RLS policies allow,
// which is why the policies in 0001_init.sql matter so much.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
