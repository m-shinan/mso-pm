// Development seed: a demo organization with realistic data.
//   npm run seed:demo                     (creates/reuses demo@example.com + 3 teammates)
//   npm run seed:demo -- --add you@x.com  (also adds your existing account as owner)
// Writes DEMO_EMAIL / DEMO_PASSWORD to .env.local. Never run against production data.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !secret || !publishable) throw new Error("Run with .env.local loaded");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
const addIdx = process.argv.indexOf("--add");
const addEmail = addIdx > 0 ? process.argv[addIdx + 1]?.toLowerCase() : null;

const DAY = 86_400_000;
const day = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

async function ensureUser(email, name, password) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    if (password) await admin.auth.admin.updateUserById(existing.id, { password });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: password ?? randomBytes(18).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw error;
  return data.user.id;
}

// ---- Users ---------------------------------------------------------------
const env = readFileSync(".env.local", "utf8");
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@example.com";
let DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  DEMO_PASSWORD = `Demo-${randomBytes(9).toString("base64url")}`;
  if (!env.includes("DEMO_PASSWORD=")) appendFileSync(".env.local", `DEMO_EMAIL=${DEMO_EMAIL}\nDEMO_PASSWORD=${DEMO_PASSWORD}\n`);
}
const ownerId = await ensureUser(DEMO_EMAIL, "Muhammed S.", DEMO_PASSWORD);
const aisha = await ensureUser("demo-aisha@example.com", "Aisha R.");
const jomon = await ensureUser("demo-jomon@example.com", "Jomon K.");
const fathima = await ensureUser("demo-fathima@example.com", "Fathima N.");

const owner = createClient(url, publishable, opts);
must(await owner.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }), "sign in demo");

// ---- Organization (recreated each run) -----------------------------------
const SLUG = "arclight-demo";
await admin.from("organizations").delete().eq("slug", SLUG);
const org = must(await owner.rpc("create_organization", { p_name: "Arclight Dev (demo)", p_slug: SLUG, p_timezone: "Asia/Dubai" }), "create org");
const O = org.id;

const roles = Object.fromEntries(must(await admin.from("roles").select("id, key").eq("organization_id", O), "roles").map((r) => [r.key, r.id]));
must(await admin.from("organization_members").insert([
  { organization_id: O, user_id: aisha, role_id: roles.developer },
  { organization_id: O, user_id: jomon, role_id: roles.developer },
  { organization_id: O, user_id: fathima, role_id: roles.admin },
]), "members");
if (addEmail) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const you = list.users.find((u) => u.email === addEmail);
  if (!you) console.warn(`--add: no account for ${addEmail}; sign up first, then rerun.`);
  else must(await admin.from("organization_members").insert({ organization_id: O, user_id: you.id, role_id: roles.owner }), "add you");
}

const opt = Object.fromEntries(must(await admin.from("options").select("id, kind, name").eq("organization_id", O), "options").map((o) => [`${o.kind}:${o.name}`, o.id]));
const ts = (n) => opt[`task_status:${n}`];
const pr = (n) => opt[`task_priority:${n}`];

// ---- Clients & projects ---------------------------------------------------
const clients = must(await owner.from("clients").insert([
  { organization_id: O, name: "Karam Trading", industry: "Retail", contact_name: "Yusuf Karam", contact_role: "Owner", notes: "Prefers WhatsApp for quick approvals, email for anything with money.\nInvoices go to accounts, net 15. Hosting renews every June." },
  { organization_id: O, name: "Dune Café", industry: "Restaurant", contact_name: "Layla H.", contact_role: "Manager" },
  { organization_id: O, name: "Falcon Logistics", industry: "Logistics", contact_name: "Omar F.", contact_role: "Operations" },
  { organization_id: O, name: "Noor Institute", industry: "Education", contact_name: "Dr. Sana N.", contact_role: "Director" },
], { defaultToNull: false }).select("id, name"), "clients");
const C = Object.fromEntries(clients.map((c) => [c.name, c.id]));

const proj = async (key, name, description, client, type, status, priority, start, due) =>
  must(await owner.from("projects").insert({
    organization_id: O, key, name, description, client_id: client ? C[client] : null, created_by: ownerId,
    type_id: opt[`project_type:${type}`], status_id: opt[`project_status:${status}`], priority_id: pr(priority),
    start_date: start === null ? null : day(start), due_date: due === null ? null : day(due),
  }).select("id").single(), `project ${key}`).id;

const SKR = await proj("SKR", "Souq Karam", "Online store with Arabic/English catalogue, COD and card payments, delivery tracking.", "Karam Trading", "E-commerce", "In progress", "High", -86, 35);
const DCM = await proj("DCM", "Dune Café Menu", "QR digital menu with Arabic menu, table codes and daily specials.", "Dune Café", "Digital menu", "Client review", "High", -60, 8);
const FER = await proj("FER", "Falcon ERP", "Inventory, purchasing and fleet modules for a logistics company.", "Falcon Logistics", "ERP", "In progress", "Medium", -40, 81);
const NAC = await proj("NAC", "Noor Academy", "LMS with courses, quizzes and certificates.", "Noor Institute", "LMS", "In progress", "Medium", -20, 117);
const KSA = await proj("KSA", "Karam Shopper app", "Mobile companion app for Souq Karam.", "Karam Trading", "Mobile app", "Planning", "Low", 10, 156);

must(await owner.from("project_members").insert([
  ...[aisha, jomon, fathima].map((u) => ({ project_id: SKR, organization_id: O, user_id: u })),
  { project_id: DCM, organization_id: O, user_id: jomon },
  { project_id: FER, organization_id: O, user_id: aisha },
  { project_id: NAC, organization_id: O, user_id: fathima },
  { project_id: KSA, organization_id: O, user_id: jomon },
]), "project members");
must(await owner.from("project_pins").insert([SKR, DCM, FER].map((p) => ({ user_id: ownerId, project_id: p, organization_id: O }))), "pins");

// ---- Releases & milestones -----------------------------------------------
const rel = async (project, version, name, status, date) =>
  must(await owner.from("releases").insert({
    organization_id: O, project_id: project, version, name, status_id: opt[`release_status:${status}`], release_date: day(date),
    ...(status === "Released" ? { released_at: new Date(Date.now() + date * DAY).toISOString(), changelog: { added: [name], changed: [], fixed: [] } } : {}),
  }).select("id").single(), `release ${version}`).id;
const R120 = await rel(SKR, "v1.2.0", "Payments & delivery", "In progress", 12);
await rel(SKR, "v1.1.0", "Wishlist", "Released", -23);
await rel(DCM, "v2.3.0", "Table QR codes", "Released", -1);
await rel(FER, "v1.0.0", "Inventory + purchasing", "In progress", 19);
must(await owner.from("milestones").insert([
  { organization_id: O, project_id: FER, name: "Purchasing module", due_date: day(-15) },
  { organization_id: O, project_id: FER, name: "Inventory module", due_date: day(19) },
]), "milestones");

// ---- Labels & tasks ------------------------------------------------------
const labels = must(await owner.from("labels").insert(["Frontend", "Backend", "API", "Payments", "Admin"].map((name) => ({ organization_id: O, name }))).select("id, name"), "labels");
const L = Object.fromEntries(labels.map((l) => [l.name, l.id]));

const tasks = [
  [SKR, "Integrate shipping rate API", "In progress", "Urgent", ownerId, -2, "API", { release_id: R120 }, ["Get sandbox keys", "Rate request", "Map zones", "Error handling", "Cache rates"], 3],
  [SKR, "Coupon rules: minimum basket and category", "In progress", "High", aisha, 4, "Backend", { release_id: R120 }],
  [SKR, "Order tracking page", "Review", "Medium", jomon, 6, "Frontend", { release_id: R120 }],
  [SKR, "Checkout address autocomplete", "Review", "High", fathima, 0, "Frontend", { release_id: R120 }],
  [SKR, "Admin: bulk price update from CSV", "Review", "Medium", ownerId, 5, "Admin"],
  [SKR, "Pay-in-installments option at checkout", "Testing", "High", fathima, 2, "Payments", { release_id: R120 }],
  [SKR, "Search filters: size and colour", "Testing", "Medium", jomon, 5, "Frontend", { release_id: R120 }],
  [SKR, "Sync stock levels from warehouse system", "Blocked", "High", aisha, 1, "API", { release_id: R120, blocked_reason: "Waiting on client: ERP API keys" }],
  [SKR, "Product image zoom on mobile", "Todo", "Low", jomon, 1, "Frontend"],
  [SKR, "Wishlist sync for guest users", "Todo", "Medium", aisha, 7, "API"],
  [SKR, "Invoice PDF with VAT breakdown", "Todo", "High", ownerId, 11, "Backend", { release_id: R120 }],
  [SKR, "Abandoned cart reminder email", "Todo", "Medium", null, null, "Backend"],
  [SKR, "Gift wrapping option", "Backlog", "Low", null, null, "Frontend"],
  [SKR, "Loyalty points", "Backlog", "Medium", null, null, "Backend"],
  [SKR, "Arabic product slugs", "Done", "Medium", jomon, -6, "Frontend"],
  [DCM, "QR code generator for table cards", "Review", "High", ownerId, 0, "Frontend"],
  [DCM, "Daily specials banner", "Todo", "Medium", jomon, 3, "Frontend"],
  [DCM, "Arabic menu import", "Done", "High", jomon, -9, "Backend"],
  [FER, "Purchase order approval flow", "Todo", "High", ownerId, 0, "Backend"],
  [FER, "Supplier price lists import", "In progress", "Medium", aisha, 6, "Backend"],
  [FER, "Stock adjustment audit trail", "Backlog", "Medium", null, null, "Backend"],
  [NAC, "Quiz timer and auto-submit", "Testing", "Medium", ownerId, 0, "Frontend"],
  [NAC, "Course import from spreadsheet", "Done", "Medium", fathima, -9, "Backend"],
  [NAC, "Certificate templates", "Todo", "Low", fathima, 20, "Frontend"],
  [KSA, "App navigation and auth screens", "Backlog", "Medium", jomon, 30, "Frontend"],
];
const ids = {};
for (const [project, title, status, priority, assignee, due, label, extra = {}, checklist = [], doneCount = 0] of tasks) {
  const t = must(await owner.from("tasks").insert({
    organization_id: O, project_id: project, title, status_id: ts(status), priority_id: pr(priority), assignee_id: assignee,
    due_date: due === null ? null : day(due), reporter_id: ownerId, number: 0, ...extra,
  }).select("id").single(), `task ${title}`);
  ids[title] = t.id;
  must(await owner.from("task_labels").insert({ task_id: t.id, label_id: L[label], project_id: project, organization_id: O }), "label");
  if (checklist.length) {
    must(await owner.from("checklist_items").insert(checklist.map((body, i) => ({ organization_id: O, project_id: project, task_id: t.id, body, done: i < doneCount, sort_order: i }))), "checklist");
  }
}

// ---- Issues ---------------------------------------------------------------
const iss = async (project, title, status, sev, priority, assignee, env, more = {}) =>
  must(await owner.from("issues").insert({
    organization_id: O, project_id: project, title, status_id: opt[`issue_status:${status}`], severity_id: opt[`issue_severity:${sev}`],
    priority_id: pr(priority), assignee_id: assignee, environment: env, reporter_id: ownerId, number: 0, ...more,
  }).select("id").single(), `issue ${title}`).id;
const I88 = await iss(SKR, "Checkout fails on Apple Pay for saved cards", "In progress", "Critical", "Urgent", ownerId, "Production · iOS 17, Safari", {
  steps: ["Sign in with an account that has a saved Visa card.", "Add any item to the cart and open checkout.", "Choose Apple Pay and confirm with Face ID."],
  expected: "Payment completes and the order confirmation page opens.",
  actual: "Spinner for ~20 s, then “Payment not completed”. Card is charged.",
  release_id: R120,
});
await iss(FER, "Stock goes negative after a partial return", "Open", "Critical", "High", aisha, "Staging");
await iss(NAC, "Arabic RTL layout breaks on the course player", "Ready for testing", "High", "High", fathima, "Production");
await iss(DCM, "Menu shows old prices after cache purge", "Ready for testing", "High", "Medium", jomon, "Production");
await iss(SKR, "Wrong sort order in “New arrivals”", "Open", "Medium", "Medium", null, "Production");
await iss(KSA, "Push notification opens a blank screen on Android 14", "Open", "Medium", "Medium", jomon, "Beta");
await iss(NAC, "Certificate PDF falls back to default font", "Resolved", "Low", "Low", fathima, "Staging");

must(await owner.from("comments").insert({ organization_id: O, project_id: SKR, issue_id: I88, author_id: ownerId, body: "Gateway returns a timeout on the token call; the webhook still captures. Adding an idempotency key." }), "comment");

// A few changes so the activity feed and notifications have history.
must(await owner.from("tasks").update({ status_id: ts("Blocked") }).eq("id", ids["Sync stock levels from warehouse system"]), "move");
must(await owner.from("tasks").update({ assignee_id: aisha }).eq("id", ids["Supplier price lists import"]), "assign");

// ---- Documents ------------------------------------------------------------
must(await owner.from("documents").insert([
  { organization_id: O, project_id: SKR, title: "Deployment notes", updated_by: ownerId, body: "Production: Vercel project souq-karam (team Arclight)\nDatabase: Supabase, region ap-south-1\nSecrets: Vercel env vars STRIPE_KEY, SHIPPING_API_KEY — never paste values here.\n\nRelease steps\n1. Merge to main\n2. Check preview deploy\n3. Promote to production\n4. Post the changelog to the client" },
  { organization_id: O, project_id: SKR, title: "Payment gateway integration", updated_by: fathima, body: "Tokenise cards on the client, capture on the server. Webhook: /api/payments/webhook (idempotent)." },
  { organization_id: O, project_id: FER, title: "Inventory data model", updated_by: aisha, body: "Stock moves are append-only. Current stock = sum of moves per item and warehouse." },
  { organization_id: O, project_id: DCM, title: "Menu import format", updated_by: jomon, body: "CSV columns: category, name_en, name_ar, price, available." },
]), "documents");

console.log(`Seeded "${org.name}" at /${org.slug}`);
console.log(`Sign in as ${DEMO_EMAIL} (password in .env.local as DEMO_PASSWORD)${addEmail ? `; ${addEmail} added as owner` : ""}`);
