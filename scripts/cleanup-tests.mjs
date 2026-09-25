// Remove leftovers from test runs: organizations named a-t…/b-t…/e2e… and users mso-t…/mso-e2e…@example.com.
//   node --env-file=.env.local scripts/cleanup-tests.mjs [--also slug1,slug2] [--users a@x.com,b@x.com]
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1].split(",").filter(Boolean) : [];
};

const { data: orgs } = await admin.from("organizations").select("id, slug");
const doomed = (orgs ?? []).filter((o) => /^([ab]-t|e2e)[a-z0-9]+$/.test(o.slug) || arg("--also").includes(o.slug));
for (const o of doomed) {
  const { data: files } = await admin.from("attachments").select("storage_path").eq("organization_id", o.id);
  if (files?.length) await admin.storage.from("attachments").remove(files.map((f) => f.storage_path));
  const { error } = await admin.from("organizations").delete().eq("id", o.id);
  console.log(error ? `FAILED ${o.slug}: ${error.message}` : `deleted org ${o.slug}`);
}

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const extra = arg("--users");
for (const u of list.users.filter((u) => /^mso-(t|e2e)[a-z0-9]+-[a-z]+@example\.com$/.test(u.email ?? "") || extra.includes(u.email ?? ""))) {
  const { error } = await admin.auth.admin.deleteUser(u.id);
  console.log(error ? `FAILED ${u.email}: ${error.message}` : `deleted user ${u.email}`);
}
