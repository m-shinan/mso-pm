// Dev helper: create (or reset) a confirmed user. node --env-file=.env.local scripts/mkuser.mjs email password "Full Name"
import { createClient } from "@supabase/supabase-js";

const [email, password, name = email.split("@")[0]] = process.argv.slice(2);
if (!email || !password) throw new Error("usage: mkuser.mjs <email> <password> [name]");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existing = list.users.find((u) => u.email === email.toLowerCase());
const res = existing
  ? await admin.auth.admin.updateUserById(existing.id, { password })
  : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
if (res.error) throw res.error;
console.log(existing ? "updated" : "created", email);
