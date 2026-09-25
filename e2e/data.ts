// What setup.ts created, shared with the specs and teardown through a JSON file.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

export const AUTH_DIR = "e2e/.auth";
export const DATA_FILE = `${AUTH_DIR}/data.json`;

export interface E2EData {
  run: string;
  email: string;
  password: string;
  userId: string;
  mateId: string;
  orgId: string;
  orgSlug: string;
  projectId: string;
  /** Option ids by "kind:name", e.g. "task_status:In progress". */
  options: Record<string, string>;
}

export const readData = (): E2EData => JSON.parse(readFileSync(DATA_FILE, "utf8"));

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
