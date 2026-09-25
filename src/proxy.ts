import { NextResponse, type NextRequest } from "next/server";

// Top-level routes that are not organization slugs.
const RESERVED = new Set(["login", "onboarding", "invite", "api"]);

/**
 * Remembers the last organization visited so "/" can send you back to it.
 * Phase 2 adds the Supabase session refresh here. Authorization never happens
 * here — it is enforced by RLS.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const slug = request.nextUrl.pathname.split("/")[1];
  if (slug && !RESERVED.has(slug) && request.cookies.get("last_org")?.value !== slug) {
    response.cookies.set("last_org", slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  // Skip static files and Next internals.
  matcher: ["/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
