// Turn on email notifications by storing the Resend settings in Supabase Vault.
//   RESEND_API_KEY=re_... node --env-file=.env.local scripts/email-setup.mjs "mso-pm <notify@yourdomain.com>" https://your-app.vercel.app
//   node --env-file=.env.local scripts/email-setup.mjs --off      (removes the key; emails stop)
// The key is read from the environment so it never lands in shell history or files.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function put(name, value) {
  const { rows } = await client.query("select id from vault.secrets where name = $1", [name]);
  if (rows.length) await client.query("select vault.update_secret($1, $2)", [rows[0].id, value]);
  else await client.query("select vault.create_secret($1, $2)", [value, name]);
}

await client.connect();
try {
  if (process.argv[2] === "--off") {
    await client.query("delete from vault.secrets where name = 'resend_api_key'");
    console.log("Email notifications are off.");
  } else {
    const [from, appUrl] = process.argv.slice(2);
    const key = process.env.RESEND_API_KEY;
    if (!key || !from || !appUrl) {
      console.error('usage: RESEND_API_KEY=re_... node --env-file=.env.local scripts/email-setup.mjs "Name <addr@domain>" https://app-url');
      process.exit(1);
    }
    await put("resend_api_key", key);
    await put("email_from", from);
    await put("app_url", appUrl.replace(/\/+$/, ""));
    console.log(`Email notifications are on, sent from ${from}, linking to ${appUrl}.`);
  }
} finally {
  await client.end();
}
