import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must call getUser() (not getSession()) per SSR docs.
  // Do not add any logic between createServerClient and getUser() that could
  // potentially respond before cookies are written.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Routes that bounce authenticated users to home
  const isSignInOrUp = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  // Routes that are accessible without a session (but don't bounce authed users)
  const isPublicRoute =
    isSignInOrUp ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/reset-password");

  // Unauthenticated user hitting a protected route → redirect to sign-in
  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated user hitting sign-in or sign-up → redirect to home
  if (user && isSignInOrUp) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
