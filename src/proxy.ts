import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicPaths = ["/login", "/auth/callback", "/design-system-showcase"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow public paths without auth
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // If already logged in, redirect away from login
    if (user && pathname === "/login") {
      const { data: loginUserData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      const url = request.nextUrl.clone();
      url.pathname = loginUserData?.role === "admin" ? "/admin/calendar" : "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Not authenticated → login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check user role and onboarding status
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = userData?.role || "shooter";

  // Check if shooter has completed onboarding
  if (role === "shooter") {
    const { data: profile } = await supabase
      .from("shooter_profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single();

    const onboardingCompleted = profile?.onboarding_completed === true;

    // Redirect to onboarding if not completed (unless already there)
    if (!onboardingCompleted && !pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Redirect away from onboarding if already completed
    if (onboardingCompleted && pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Block shooters from admin routes
    if (pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Admins can access everything — redirect root and /admin to admin weddings
  if (role === "admin" && (pathname === "/" || pathname === "/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/calendar";
    return NextResponse.redirect(url);
  }

  // Shooters — redirect root to dashboard
  if (role === "shooter" && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
