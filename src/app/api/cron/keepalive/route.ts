import { createClient } from "@supabase/supabase-js";

// Called by Vercel cron (vercel.json) every 5 days. Free-tier Supabase pauses a
// project after 7 days without API activity; one small query keeps it awake.
// Uses the public key, so RLS applies and the result is just an empty list.
// No secret needed: it reveals nothing and does nothing a visitor can't.
export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  // chat_channels is one of the few tables the anon role is granted (RLS still hides every row).
  const { error } = await supabase.from("chat_channels").select("id").limit(1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
