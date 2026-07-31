import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// This file lives in the PROJECT ROOT, next to package.json.
// Not inside app/. If it's in the wrong place it silently does nothing.
//
// Two jobs:
//   1. Refresh the auth token on every request (without this, users get
//      logged out at random and you'll spend a day chasing it)
//   2. Bounce signed-out users to /login

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser(), not getSession(). getSession() reads the cookie and trusts
  // it; getUser() actually asks Supabase whether the token is real.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /api/mobile/* is for the native app, which has no cookie jar — it sends a
  // Supabase access token as a Bearer header instead. Each of those routes
  // verifies that token itself and 401s without it, so they must skip this
  // cookie check; otherwise they get bounced to /login and the app just hangs.
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/mobile");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
