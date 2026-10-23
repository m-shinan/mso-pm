import "server-only";
import { AwsClient } from "aws4fetch";

// Attachments live in Cloudflare R2 (no egress fees). Browsers upload and
// download directly with short-lived signed URLs; the keys stay on the server.
// Who may touch which file is still decided by RLS on the attachments table.

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return { account: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET };
}

export function r2Configured() {
  return config() !== null;
}

function setup() {
  const c = config();
  if (!c) throw new Error("R2 is not configured");
  const client = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, service: "s3", region: "auto" });
  const url = (key: string) =>
    new URL(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  return { client, url };
}

/** A URL the browser can PUT exactly this file to, for `seconds`. Type and size are signed, so they can't be changed. */
export async function presignUpload(key: string, contentType: string, size: number, seconds = 300) {
  const { client, url } = setup();
  const u = url(key);
  u.searchParams.set("X-Amz-Expires", String(seconds));
  const signed = await client.sign(u.toString(), {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(size) },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

// Shown in the browser; anything else (HTML, SVG, PDF scripts...) is downloaded, never rendered.
const INLINE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** A URL that opens or downloads the file, for `seconds`. */
export async function presignDownload(key: string, file: { name: string; type: string }, seconds = 60) {
  const { client, url } = setup();
  const u = url(key);
  const inline = INLINE.has(file.type);
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  u.searchParams.set("X-Amz-Expires", String(seconds));
  u.searchParams.set(
    "response-content-disposition",
    `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  u.searchParams.set("response-content-type", inline ? file.type : "application/octet-stream");
  const signed = await client.sign(u.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

/** Best effort: a file left behind is removed by the weekly cleanup (scripts/r2-cleanup.mjs). */
export async function deleteObject(key: string) {
  try {
    const { client, url } = setup();
    await client.fetch(url(key).toString(), { method: "DELETE" });
  } catch {}
}
