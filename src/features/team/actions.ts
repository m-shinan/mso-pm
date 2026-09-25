"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { createClient, getUserId } from "@/lib/supabase/server";

export interface InviteResult {
  error?: string;
  links?: { email: string; url: string }[];
}

const input = z.object({
  organizationId: z.uuid(),
  roleId: z.uuid(),
  emails: z.array(z.string().trim().toLowerCase().pipe(z.email())).min(1).max(20),
});

/**
 * Create invitations. The random token only exists in the returned link; the
 * database stores its sha256. RLS checks members.invite and blocks the owner role.
 * Links are returned to share directly (Supabase's built-in email only reaches
 * your own Supabase team, so we don't pretend to send mail).
 */
export async function createInvitations(raw: z.input<typeof input>): Promise<InviteResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Check the email addresses and try again." };
  const userId = await getUserId();
  if (!userId) return { error: "Your session ended. Sign in again." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const rows = parsed.data.emails.map((email) => {
    const token = randomBytes(24).toString("base64url");
    return { email, token, token_hash: createHash("sha256").update(token).digest("hex") };
  });

  const { error } = await supabase.from("invitations").insert(
    rows.map((r) => ({
      organization_id: parsed.data.organizationId,
      email: r.email,
      role_id: parsed.data.roleId,
      token_hash: r.token_hash,
      invited_by: userId,
    })),
  );
  if (error) {
    if (error.code === "23505") return { error: "One of these people already has a pending invitation. Revoke it first to send a new one." };
    return { error: friendlyError(error, "create the invitation") };
  }
  return { links: rows.map((r) => ({ email: r.email, url: `${origin}/invite/${r.token}` })) };
}
