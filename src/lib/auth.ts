/** Where signed-in people land: redirects on to their last organization. */
export const HOME = "/app";

/** How long a sign-in lasts before the user has to sign in again, however active they are. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Only allow redirects back into this app. Resolving against a dummy origin
 * catches tricks a prefix check misses (`/\evil.com`, `/\t/evil.com`), which
 * browsers read as `//evil.com`.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return HOME;
  const base = "http://app.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : HOME;
  } catch {
    return HOME;
  }
}

/**
 * True when the session began more than SESSION_MAX_AGE_SECONDS ago. The
 * earliest `amr` timestamp is when the user signed in; token refreshes keep it.
 */
export function sessionExpired(claims: { amr?: unknown } | undefined, nowSeconds = Date.now() / 1000): boolean {
  const amr = Array.isArray(claims?.amr) ? claims.amr : [];
  const times = amr.map((e) => (e as { timestamp?: unknown })?.timestamp).filter((t): t is number => typeof t === "number");
  if (!times.length) return false;
  return nowSeconds - Math.min(...times) > SESSION_MAX_AGE_SECONDS;
}
