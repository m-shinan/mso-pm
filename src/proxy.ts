import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that work without a session.
const PUBLIC = ["/login", "/signup", "/reset-password", "/auth/"];
// Top-level routes that are not organization slugs.
const RESERVED = new Set(["login", "signup", "reset-password", "onboarding", "invite", "auth", "account", "api"]);

/**
 * Refreshes the Supabase session on every navigation and sends signed-out
 * visitors to /login. This is a convenience redirect only — every query is
 * still authorized by RLS in the database.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet, headers) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Never let a CDN cache a response that sets auth cookies.
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Nothing may run between creating the client and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && !PUBLIC.some((p) => path === p || path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return redirectWithCookies(url, response);
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  // Remember the last organization so "/" can return to it.
  const slug = path.split("/")[1];
  if (signedIn && slug && !RESERVED.has(slug) && request.cookies.get("last_org")?.value !== slug) {
    response.cookies.set("last_org", slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  from.headers.forEach((v, k) => {
    if (["cache-control", "expires", "pragma"].includes(k)) res.headers.set(k, v);
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
