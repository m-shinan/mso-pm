// Turn database/API errors into sentences people can act on.
// The raw error is logged for debugging; users never see codes or SQL.

interface DbError {
  code?: string;
  message?: string;
  details?: string | null;
}

export function friendlyError(error: unknown, action = "save this"): string {
  const e = (error ?? {}) as DbError;
  if (process.env.NODE_ENV !== "production") console.error(`[mso-pm] ${action}:`, e);
  const msg = e.message ?? "";
  switch (e.code) {
    case "23505":
      if (msg.includes("slug")) return "That URL is taken. Try another.";
      if (msg.includes("key")) return "Another project already uses that key.";
      if (msg.includes("version")) return "This project already has a release with that version.";
      if (msg.includes("name")) return "Something with that name already exists.";
      return "That already exists.";
    case "23503":
      return "It’s still in use, so it can’t be removed. Archive it instead.";
    case "23514":
      if (msg.includes("owner")) return "An organization needs at least one owner.";
      return "Some of the values aren’t valid. Check the form and try again.";
    case "42501":
      if (msg.toLowerCase().includes("owner")) return "Only an owner can do that.";
      if (msg.toLowerCase().includes("email")) return msg;
      return "You don’t have permission to do that.";
    case "P0002":
      return msg || "Not found.";
    case "28000":
      return "Your session ended. Sign in again.";
    case "54000":
      return "You’ve reached the limit for this.";
    case "PGRST116":
      return "Not found, or you don’t have access.";
  }
  if (msg.includes("row-level security")) return "You don’t have permission to do that.";
  if (msg.toLowerCase().includes("fetch")) return "Couldn’t reach the server. Check your connection and try again.";
  return `Couldn’t ${action}. Please try again.`;
}
