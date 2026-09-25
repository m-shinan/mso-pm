"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { addComment, deleteComment } from "@/features/issues/mutations";
import type { CommentRow } from "@/features/issues/queries";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";

/** Latest 20 comments + a composer. Ctrl/⌘ Enter posts. */
export function Comments({
  initial,
  target,
}: {
  initial: CommentRow[];
  target: { organizationId: string; projectId: string; issueId?: string; taskId?: string };
}) {
  const { member, currentUserId, can } = useOrg();
  const toast = useToast();
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const canComment = can("tasks.update") || can("issues.update");

  async function post(e?: FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    const { data, error } = await addComment({ ...target, body: text }, currentUserId);
    setSaving(false);
    if (error || !data) return toast({ message: friendlyError(error, "post the comment") });
    setComments((c) => [...c, data]);
    setBody("");
  }

  async function remove(id: string) {
    const before = comments;
    setComments((c) => c.filter((x) => x.id !== id));
    const { error } = await deleteComment(id);
    if (error) {
      setComments(before);
      toast({ message: friendlyError(error, "delete the comment") });
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void post();
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((c) => {
        const who = member(c.author_id);
        return (
          <div key={c.id} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
            <Avatar person={who} />
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[12.5px]">
                <span className="font-medium">{c.author_id === currentUserId ? "You" : who?.name ?? "Former member"}</span>
                <span suppressHydrationWarning className="text-ink-4">· {timeAgo(c.created_at)}</span>
                {c.author_id === currentUserId ? (
                  <button type="button" onClick={() => remove(c.id)} className="ml-auto text-xs text-ink-4 hover:text-danger-ink">Delete</button>
                ) : null}
              </span>
              <p className="text-sm leading-normal whitespace-pre-line text-[#2A2A30]">{c.body}</p>
            </div>
          </div>
        );
      })}
      {canComment ? (
        <form onSubmit={post} className="flex flex-col gap-2 rounded-lg border border-line p-2 focus-within:border-accent">
          <textarea
            aria-label="Write a comment"
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            maxLength={10000}
            className="resize-none bg-transparent px-1 text-sm outline-none max-lg:text-lg"
          />
          <div className="flex items-center justify-end gap-2">
            <Kbd className="max-lg:hidden">Ctrl ↵</Kbd>
            <button type="submit" disabled={!body.trim() || saving} className="h-7 rounded-md bg-accent px-2.5 text-xs font-medium text-white disabled:bg-muted disabled:text-ink-5 max-lg:h-10 max-lg:px-4 max-lg:text-sm">
              {saving ? "Posting…" : "Comment"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
