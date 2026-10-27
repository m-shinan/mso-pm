import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Approves or denies an OAuth request from the consent page and sends the user back to the client app. */
export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("authorization_id") ?? "");
  const supabase = await createClient();
  const { data, error } =
    form.get("decision") === "approve"
      ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data) return NextResponse.redirect(new URL(`/oauth/consent?authorization_id=${encodeURIComponent(id)}`, request.url), 303);
  return NextResponse.redirect(data.redirect_url, 303);
}
