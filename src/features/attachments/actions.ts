"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { deleteObject, presignDownload, presignUpload, r2Configured } from "@/lib/r2";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { AttachmentRow } from "@/features/tasks/queries";

// Same limit as attachments.size_bytes in the database.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const COLUMNS = "id, name, size_bytes, mime_type, storage_path, uploaded_by, created_at";

const uploadInput = z
  .object({
    orgId: z.uuid(),
    projectId: z.uuid(),
    taskId: z.uuid().optional(),
    issueId: z.uuid().optional(),
    name: z.string().trim().min(1).max(200),
    size: z.number().int().min(0).max(MAX_ATTACHMENT_BYTES),
    type: z.string().max(100),
  })
  .refine((v) => Boolean(v.taskId) !== Boolean(v.issueId), "Attach to a task or an issue");

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

/**
 * Step 1 of an upload: record the attachment (RLS decides whether you may) and
 * get a signed URL to PUT the file to R2. If the PUT fails, call cancelUpload.
 */
export async function startUpload(
  input: z.input<typeof uploadInput>,
): Promise<{ row: AttachmentRow; uploadUrl: string; contentType: string } | { error: string }> {
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "That file can’t be attached (10 MB at most)." };
  if (!r2Configured()) return { error: "File storage isn’t set up yet." };
  const userId = await getUserId();
  if (!userId) return { error: "Your session ended. Sign in again." };

  const v = parsed.data;
  const kind = v.taskId ? "task" : "issue";
  const contentType = v.type || "application/octet-stream";
  const key = `${v.orgId}/${v.projectId}/${kind}/${v.taskId ?? v.issueId}/${randomUUID()}-${safeName(v.name)}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .insert({
      organization_id: v.orgId,
      project_id: v.projectId,
      task_id: v.taskId ?? null,
      issue_id: v.issueId ?? null,
      storage_path: key,
      name: v.name,
      size_bytes: v.size,
      mime_type: contentType,
      uploaded_by: userId,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) return { error: friendlyError(error, `attach ${v.name}`) };
  return { row: data, uploadUrl: await presignUpload(key, contentType, v.size), contentType };
}

/** The upload didn't make it: drop the record so no broken link is left. */
export async function cancelUpload(id: string) {
  const supabase = await createClient();
  await supabase.from("attachments").delete().eq("id", id);
}

/** A 60-second link to open or download a file you can see. */
export async function attachmentUrl(id: string): Promise<{ url: string } | { error: string }> {
  if (!r2Configured()) return { error: "File storage isn’t set up yet." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("attachments").select("storage_path, name, mime_type").eq("id", id).single();
  if (error || !data) return { error: friendlyError(error, "open the file") };
  return { url: await presignDownload(data.storage_path, { name: data.name, type: data.mime_type }) };
}

/** Delete the record (RLS: your own upload, or tasks.delete), then the file. */
export async function deleteAttachment(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("attachments").delete().eq("id", id).select("storage_path").single();
  if (error || !data) return { error: friendlyError(error, "delete the file") };
  await deleteObject(data.storage_path);
  return {};
}
