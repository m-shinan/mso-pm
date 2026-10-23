// Make an email a platform admin (super admin of this installation: /admin and
// the feedback inbox). The person signs up with that email as usual.
//   node --env-file=.env.local scripts/platform-admin.mjs you@example.org
//   node --env-file=.env.local scripts/platform-admin.mjs --list
// After the first one, admins can add or remove others in the Admin console.
import pg from "pg";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: scripts/platform-admin.mjs <email> | --list");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  if (arg !== "--list") {
    const email = arg.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`not an email address: ${arg}`);
    await client.query("insert into private.platform_admins (email) values ($1) on conflict do nothing", [email]);
    console.log(`${email} is a platform admin.`);
  }
  const { rows } = await client.query("select email from private.platform_admins order by email");
  console.log(`Platform admins: ${rows.map((r) => r.email).join(", ") || "(none)"}`);
} finally {
  await client.end();
}
