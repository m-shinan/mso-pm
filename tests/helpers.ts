// Test helpers: real users against the real project, cleaned up afterwards.
// Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
if (!url || !publishable || !secret) throw new Error("Supabase env vars missing — run with .env.local loaded");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(url, secret, opts);
export const anon = () => createClient(url, publishable, opts);

export const RUN = `t${Date.now().toString(36)}`;
const PASSWORD = `Pw-${randomBytes(12).toString("hex")}`;
const created: string[] = [];

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

export async function makeUser(name: string): Promise<TestUser> {
  const email = `mso-${RUN}-${name}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test ${name}` },
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(url, publishable, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function cleanup(orgIds: string[]) {
  if (orgIds.length) await admin.from("organizations").delete().in("id", orgIds);
  for (const id of created) await admin.auth.admin.deleteUser(id);
}

export function sha256(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function token() {
  return randomBytes(24).toString("base64url");
}

/** Throw with context if a Supabase call errored. */
export function ok<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
