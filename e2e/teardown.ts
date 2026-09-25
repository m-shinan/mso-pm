// Deletes everything setup.ts created, including uploaded files.
import { test as teardown } from "@playwright/test";
import { existsSync, rmSync } from "node:fs";
import { admin, AUTH_DIR, DATA_FILE, readData } from "./data";

teardown("delete test organization and users", async () => {
  if (!existsSync(DATA_FILE)) return;
  const d = readData();
  const db = admin();

  const files = await db.from("attachments").select("storage_path").eq("organization_id", d.orgId);
  if (files.data?.length) await db.storage.from("attachments").remove(files.data.map((f) => f.storage_path));

  const org = await db.from("organizations").delete().eq("id", d.orgId);
  if (org.error) throw new Error(`teardown: ${org.error.message}`);
  for (const id of [d.userId, d.mateId]) await db.auth.admin.deleteUser(id);
  rmSync(AUTH_DIR, { recursive: true, force: true });
});
