import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use this in server components and route handlers.
// Must be created fresh per request — never hoist it to a module-level
// constant, or one user's session leaks into another user's request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, which can't set cookies.
            // Harmless: middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
