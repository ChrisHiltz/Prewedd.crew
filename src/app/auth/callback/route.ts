import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// The Supabase SSR client needs to write session cookies on every call that
// might rotate the session (exchangeCodeForSession, getUser, etc). In a Route
// Handler that returns a redirect, those cookies must land on the RETURNED
// response object, not on Next's shared cookies() store — otherwise the
// browser never receives them and the next request is unauthenticated,
// bouncing the user back to /login. We build the response object upfront,
// thread it through the client's cookie setter, and mutate its Location
// header in place to set the final destination. Same pattern as src/proxy.ts.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Build the response object we'll mutate and return. Start it pointing at
  // the error destination; we'll overwrite the Location on success. Cookies
  // written by Supabase flow straight into this object's cookie jar.
  const response = NextResponse.redirect(`${origin}/login?error=auth_callback`);

  if (!code) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return response; // already points at /login?error=auth_callback
  }

  // Decide the destination.
  let destination: string;
  if (next && next.startsWith("/")) {
    destination = next;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    destination = "/dashboard";
    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (userData?.role === "admin") {
        destination = "/admin/calendar";
      }
    }
  }

  // Overwrite the Location header in place so the response still carries
  // every session cookie Supabase wrote via setAll above.
  response.headers.set("Location", `${origin}${destination}`);
  return response;
}
