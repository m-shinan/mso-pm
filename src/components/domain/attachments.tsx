"use client";

import { FileText, ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { useToast } from "@/components/ui/toast";
import { attachmentUrl, cancelUpload, deleteAttachment, startUpload } from "@/features/attachments/actions";
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

/**
 * Attachment list + upload for a task or an issue. Files live in Cloudflare R2:
 * the browser uploads and downloads directly with signed links from the
 * server, so they never pass through Supabase (no egress there) or Vercel.
 */
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

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const original of Array.from(files)) {
      setBusy(`Uploading ${original.name}…`);
      const file = await shrinkImage(original);
      if (file.size > MAX_BYTES) {
        toast({ message: `${original.name} is over 10 MB.` });
        continue;
      }
      const started = await startUpload({
        orgId: org.id,
        projectId: target.projectId,
        taskId: target.taskId,
        issueId: target.issueId,
        name: file.name.slice(0, 200),
        size: file.size,
        type: (file.type || "application/octet-stream").slice(0, 100),
      });
      if ("error" in started) {
        toast({ message: started.error });
        continue;
      }
      const put = await fetch(started.uploadUrl, { method: "PUT", headers: { "content-type": started.contentType }, body: file }).catch(() => null);
      if (!put?.ok) {
        await cancelUpload(started.row.id);
        toast({ message: `Couldn’t upload ${original.name}. Please try again.` });
        continue;
      }
      setItems((all) => [...all, started.row]);
    }
    setBusy(null);
    if (input.current) input.current.value = "";
  }

  async function open(a: AttachmentRow) {
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the signed link.
    const tab = window.open("", "_blank");
    const res = await attachmentUrl(a.id);
    if ("error" in res) {
      tab?.close();
      return toast({ message: res.error });
    }
    if (tab) {
      tab.opener = null;
      tab.location.replace(res.url);
    } else window.location.assign(res.url);
  }

  async function remove(a: AttachmentRow) {
    const before = items;
    setItems((all) => all.filter((x) => x.id !== a.id));
    const res = await deleteAttachment(a.id);
    if (res.error) {
      setItems(before);
      toast({ message: res.error });
    }
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
