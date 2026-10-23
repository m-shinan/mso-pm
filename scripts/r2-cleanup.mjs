// Delete R2 files that no attachment row points to any more (deleted tasks,
// issues or projects cascade their rows away; abandoned uploads), once they're
// a day old. Runs weekly from .github/workflows/r2-cleanup.yml.
//   node --env-file=.env.local scripts/r2-cleanup.mjs            delete
//   node --env-file=.env.local scripts/r2-cleanup.mjs --dry-run  only list
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY })) {
  if (!v) {
    console.error(`${k} is not set`);
    process.exit(1);
  }
}
const dryRun = process.argv.includes("--dry-run");
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Every key the database still references.
const referenced = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("attachments").select("storage_path").range(from, from + 999);
  if (error) throw error;
  data.forEach((r) => referenced.add(r.storage_path));
  if (data.length < 1000) break;
}

// Every object in the bucket (ListObjectsV2, 1000 per page).
const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const objects = [];
let token = null;
do {
  const url = new URL(base);
  url.searchParams.set("list-type", "2");
  if (token) url.searchParams.set("continuation-token", token);
  const res = await r2.fetch(url.toString());
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  const xml = await res.text();
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = unescape(m[1].match(/<Key>([\s\S]*?)<\/Key>/)[1]);
    const modified = new Date(m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/)[1]);
    objects.push({ key, modified });
  }
  token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unescape(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)[1]) : null;
} while (token);

const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
const orphans = objects.filter((o) => !referenced.has(o.key) && o.modified.getTime() < dayAgo);
console.log(`${objects.length} files in R2, ${referenced.size} referenced, ${orphans.length} to delete${dryRun ? " (dry run)" : ""}.`);

if (!dryRun) {
  for (const o of orphans) {
    const res = await r2.fetch(`${base}/${o.key.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) console.error(`could not delete ${o.key}: ${res.status}`);
  }
}
