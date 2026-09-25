"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const COLOR_NAMES: Record<string, string> = {
  "#6E6E76": "Grey",
  "#2D55C8": "Blue",
  "#7654C9": "Violet",
  "#0E8388": "Teal",
  "#2F8F5B": "Green",
  "#C27A06": "Amber",
  "#D9480F": "Orange",
  "#CC3A21": "Red",
};
const COLORS = Object.keys(COLOR_NAMES);

interface LabelItem {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  uses: number;
}

export function LabelsEditor({ initial }: { initial: LabelItem[] }) {
  const { org, can } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const editable = can("settings.manage");
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[1]);
  const [deleting, setDeleting] = useState<LabelItem | null>(null);
  const db = () => supabaseBrowser().from("labels");

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const { data, error } = await db().insert({ organization_id: org.id, name: n, color }).select("id, name, color, is_active").single();
    if (error || !data) return toast({ message: friendlyError(error, "add the label") });
    setItems((all) => [...all, { ...data, uses: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    router.refresh();
  }

  async function update(l: LabelItem, patch: Partial<Pick<LabelItem, "name" | "color" | "is_active">>) {
    const before = items;
    setItems((all) => all.map((x) => (x.id === l.id ? { ...x, ...patch } : x)));
    const { error } = await db().update(patch).eq("id", l.id).select("id").single();
    if (error) {
      setItems(before);
      toast({ message: friendlyError(error, "save the label") });
    } else router.refresh();
  }

  async function remove(l: LabelItem) {
    const before = items;
    setItems((all) => all.filter((x) => x.id !== l.id));
    const { error } = await db().delete().eq("id", l.id).select("id").single();
    if (error) {
      setItems(before);
      toast({ message: friendlyError(error, "delete the label") });
    } else router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Labels</h1>
        <p className="text-base leading-normal text-ink-3">
          Tags like Frontend, API or Payments, shared by every project in <span className="font-medium text-ink">{org.name}</span>. Add them to tasks from the task panel.
        </p>
      </div>

      {editable ? (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input aria-label="New label name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="New label" className="w-56" />
          <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={COLOR_NAMES[c]} onClick={() => setColor(c)}
                className={cn("size-6 rounded-full max-lg:size-8", color === c && "ring-2 ring-accent ring-offset-2")} style={{ background: c }} />
            ))}
          </div>
          <Button variant="primary" type="submit" disabled={!name.trim()} className="max-lg:h-11"><Plus aria-hidden className="size-[15px]" strokeWidth={2} />Add</Button>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-4">No labels yet.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {items.map((l) => (
            <li key={l.id} className={cn("flex min-h-12 flex-wrap items-center gap-3 border-t border-line-soft px-4 py-2 first:border-t-0", !l.is_active && "bg-sunken")}>
              <span aria-hidden className="size-3 rounded-full" style={{ background: l.color }} />
              {editable ? (
                <input
                  aria-label={`Name of ${l.name}`}
                  defaultValue={l.name}
                  maxLength={30}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== l.name && update(l, { name: e.target.value.trim() })}
                  className="min-w-0 grow rounded-md bg-transparent px-1 py-1 text-base outline-none hover:bg-subtle focus:bg-surface focus:ring-2 focus:ring-accent-ring"
                />
              ) : (
                <span className="grow">{l.name}</span>
              )}
              <span className="text-xs text-ink-4 tabular">{l.uses} {l.uses === 1 ? "task" : "tasks"}{l.is_active ? "" : " · archived"}</span>
              {editable ? (
                <span className="flex gap-1">
                  <select aria-label={`Colour of ${l.name}`} value={l.color} onChange={(e) => update(l, { color: e.target.value })} className="h-8 rounded-md border border-line bg-surface px-1 text-xs">
                    {[...new Set([l.color, ...COLORS])].map((c) => <option key={c} value={c}>{COLOR_NAMES[c] ?? "Custom"}</option>)}
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => update(l, { is_active: !l.is_active })} className="max-lg:h-10">{l.is_active ? "Archive" : "Restore"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => (l.uses ? setDeleting(l) : remove(l))} className="text-danger-ink max-lg:h-10">Delete</Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-4">Archived labels stay on existing tasks but can’t be added to new ones.</p>

      <ConfirmDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)} title={`Delete “${deleting?.name}”?`} actionLabel="Delete label" onConfirm={() => deleting && remove(deleting)}>
        <p>It’s on {deleting?.uses} tasks and will be removed from all of them. Archive it instead to keep it on existing tasks.</p>
      </ConfirmDialog>
    </div>
  );
}
