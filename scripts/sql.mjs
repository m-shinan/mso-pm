// Run SQL against the project database (dev tool, uses SUPABASE_DB_URL from .env.local).
//   node --env-file=.env.local scripts/sql.mjs -e "select 1"
//   node --env-file=.env.local scripts/sql.mjs path/to/file.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const [flag, arg] = process.argv.slice(2);
const sql = flag === "-e" ? arg : readFileSync(flag, "utf8");
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const res = await client.query(sql);
  for (const r of Array.isArray(res) ? res : [res]) {
    if (r.rows?.length) console.table(r.rows);
    else if (r.command) console.log(r.command, r.rowCount ?? "");
  }
} catch (e) {
  console.error("SQL error:", e.message, e.position ? `(at char ${e.position})` : "", e.detail ?? "", e.hint ?? "");
  process.exitCode = 1;
} finally {
  await client.end();
}
