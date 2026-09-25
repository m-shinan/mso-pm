// Creates a user, a teammate, an organization with one project and one task,
// then signs in through the real login form and saves the session.
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { admin, AUTH_DIR, DATA_FILE, type E2EData } from "./data";

setup("create test organization and sign in", async ({ page }) => {
  const db = admin();
  const run = `e2e${Date.now().toString(36)}`;
  const password = `Pw-${randomBytes(12).toString("hex")}`;
  const email = `mso-${run}-owner@example.com`;

  const user = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Erin Owner" } });
  if (user.error) throw user.error;
  const mate = await db.auth.admin.createUser({
    email: `mso-${run}-mate@example.com`, password, email_confirm: true, user_metadata: { full_name: "Milo Mate" },
  });
  if (mate.error) throw mate.error;

  // Create the organization as the user, exactly as onboarding does.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const org = await client.rpc("create_organization", { p_name: `E2E ${run}`, p_slug: run, p_template: "minimal" });
  if (org.error) throw org.error;
  const orgId = (org.data as { id: string }).id;

  const opts = await db.from("options").select("id, kind, name").eq("organization_id", orgId);
  if (opts.error) throw opts.error;
  const options = Object.fromEntries(opts.data.map((o) => [`${o.kind}:${o.name}`, o.id]));
  const firstOf = (kind: string) => opts.data.find((o) => o.kind === kind)!.id;

  const roles = await db.from("roles").select("id, key").eq("organization_id", orgId);
  const developer = roles.data!.find((r) => r.key === "developer")!.id;
  const member = await db.from("organization_members").insert({ organization_id: orgId, user_id: mate.data.user.id, role_id: developer });
  if (member.error) throw member.error;

  const project = await client
    .from("projects")
    .insert({
      organization_id: orgId, key: "WEB", name: "Website", created_by: user.data.user.id,
      type_id: firstOf("project_type"), status_id: firstOf("project_status"), priority_id: options["task_priority:Medium"],
    })
    .select("id")
    .single();
  if (project.error) throw project.error;
  const pm = await db.from("project_members").insert({ project_id: project.data.id, organization_id: orgId, user_id: mate.data.user.id });
  if (pm.error) throw pm.error;

  const task = await client.from("tasks").insert({
    organization_id: orgId, project_id: project.data.id, title: "Seed task", reporter_id: user.data.user.id,
    status_id: options["task_status:Todo"], priority_id: options["task_priority:Medium"], number: 0,
  });
  if (task.error) throw task.error;

  const data: E2EData = {
    run, email, password, userId: user.data.user.id, mateId: mate.data.user.id, orgId, orgSlug: run, projectId: project.data.id, options,
  };
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  // Sign in through the UI and keep the session for the specs.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${run}`), { timeout: 30_000 });
  await page.context().storageState({ path: `${AUTH_DIR}/owner.json` });
});
