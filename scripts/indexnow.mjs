// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver…) that the public
// pages changed. Runs after each production deploy (.github/workflows/indexnow.yml).
//   node scripts/indexnow.mjs
// The key is public by design: it must be served at /<key>.txt to prove the site is ours.
import { readdirSync } from "node:fs";

const site = (process.env.SITE_URL ?? "https://pm.mshinan.com").replace(/\/+$/, "");
const keyFile = readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error("No IndexNow key file (public/<32 hex characters>.txt).");
  process.exit(1);
}
const key = keyFile.replace(".txt", "");
const host = new URL(site).host;

// Same pages as src/app/sitemap.ts.
const urlList = ["/", "/signup", "/login", "/privacy", "/terms"].map((p) => `${site}${p}`);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `${site}/${keyFile}`, urlList }),
});
// 200/202 = accepted. 403 = key file not reachable yet; 422 = URLs don't match the host.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
if (res.status >= 400) process.exit(1);
