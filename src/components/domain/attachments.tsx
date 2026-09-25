"use client";

import { FileText, ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AttachmentRow } from "@/features/tasks/queries";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Shrink large photos/screenshots before upload (saves storage and egress).
 * PNG screenshots stay PNG so text stays sharp; photos become WebP.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 500 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/webp";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.82));
  if (!blob || blob.size >= file.size) return file;
  const ext = type === "image/png" ? ".png" : ".webp";
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ext, { type });
}

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

/** Attachment list + upload for a task or an issue. Files are private; opening creates a 60-second link. */
export function Attachments({
  initial,
  target,
}: {
  initial: AttachmentRow[];
  target: { projectId: string; taskId?: string; issueId?: string };
}) {
  const { org, can, currentUserId, member } = useOrg();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const canUpload = can("tasks.update") || can("issues.update");
  const kind = target.taskId ? "task" : "issue";
  const entityId = (target.taskId ?? target.issueId)!;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = supabaseBrowser();
    for (const original of Array.from(files)) {
      setBusy(`Uploading ${original.name}…`);
      const file = await shrinkImage(original);
      if (file.size > MAX_BYTES) {
        toast({ message: `${original.name} is over 10 MB.` });
        continue;
      }
      const path = `${org.id}/${target.projectId}/${kind}/${entityId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) {
        toast({ message: friendlyError(up.error, `upload ${original.name}`) });
        continue;
      }
      const { data, error } = await supabase
        .from("attachments")
        .insert({
          organization_id: org.id,
          project_id: target.projectId,
          task_id: target.taskId ?? null,
          issue_id: target.issueId ?? null,
          storage_path: path,
          name: file.name.slice(0, 200),
          size_bytes: file.size,
          mime_type: (file.type || "application/octet-stream").slice(0, 100),
          uploaded_by: currentUserId,
        })
        .select("id, name, size_bytes, mime_type, storage_path, uploaded_by, created_at")
        .single();
      if (error || !data) {
        await supabase.storage.from("attachments").remove([path]);
        toast({ message: friendlyError(error, `save ${original.name}`) });
        continue;
      }
      setItems((all) => [...all, data]);
    }
    setBusy(null);
    if (input.current) input.current.value = "";
  }

  async function open(a: AttachmentRow) {
    const { data, error } = await supabaseBrowser().storage.from("attachments").createSignedUrl(a.storage_path, 60);
    if (error || !data) return toast({ message: friendlyError(error, "open the file") });
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(a: AttachmentRow) {
    const supabase = supabaseBrowser();
    const before = items;
    setItems((all) => all.filter((x) => x.id !== a.id));
    const row = await supabase.from("attachments").delete().eq("id", a.id).select("id").single();
    if (row.error) {
      setItems(before);
      return toast({ message: friendlyError(row.error, "delete the file") });
    }
    await supabase.storage.from("attachments").remove([a.storage_path]);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && !canUpload ? <p className="text-sm text-ink-4">No files.</p> : null}
      <ul className="flex flex-col gap-1.5">
        {items.map((a) => {
          const Icon = a.mime_type.startsWith("image/") ? ImageIcon : FileText;
          return (
            <li key={a.id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
              <Icon aria-hidden className="size-4 shrink-0 text-ink-4" />
              <button type="button" onClick={() => open(a)} className="min-w-0 grow truncate text-left text-sm text-accent hover:text-accent-hover">
                {a.name}
              </button>
              <span className="shrink-0 text-xs text-ink-4">{sizeLabel(a.size_bytes)}</span>
              {a.uploaded_by === currentUserId || can("tasks.delete") ? (
                <button
                  type="button"
                  aria-label={`Delete ${a.name}`}
                  title={member(a.uploaded_by)?.name ? `Uploaded by ${member(a.uploaded_by)?.name}` : undefined}
                  onClick={() => remove(a)}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-4 hover:bg-subtle hover:text-danger-ink max-lg:size-10"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canUpload ? (
        <label
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-3 text-sm text-ink-3 hover:bg-sunken max-lg:min-h-12",
            busy && "pointer-events-none opacity-70",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
        >
          <Paperclip aria-hidden className="size-4" />
          {busy ?? "Attach files (max 10 MB, images are resized)"}
          <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        </label>
      ) : null}
    </div>
  );
}
