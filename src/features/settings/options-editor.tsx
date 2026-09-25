"use client";

import { ArrowDown, ArrowUp, GripVertical, Info, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input, Select } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { PriorityIcon, SeverityBadge, StatusIcon } from "@/components/domain/markers";
import type { TablesUpdate } from "@/lib/database.types";
import { friendlyError } from "@/lib/errors";
import { buildConfig } from "@/lib/options";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Option } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { OptionSection } from "./sections";

const COLORS = ["#6E6E76", "#8A8A92", "#C27A06", "#7654C9", "#0E8388", "#2D55C8", "#2F8F5B", "#CC3A21", "#D9480F", "#8A6D00"];

/**
 * Add, rename, recolour, reorder, set default, archive/restore, delete.
 * Each change is one small write; options that records use can only be archived.
 */
export function OptionsEditor({ section, initial, usage }: { section: OptionSection; initial: Option[]; usage: Record<string, number> }) {
  const { org, can } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const editable = can("settings.manage");
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Option | null>(null);
  const active = items.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const archived = items.filter((o) => !o.isActive);
  const config = buildConfig(items);
  const isWorkflow = section.kind === "task_status" || section.kind === "issue_status";
  const db = () => supabaseBrowser().from("options");

  /** Apply locally, write, roll back on failure. */
  async function change(id: string, patch: Partial<Option>, dbPatch: TablesUpdate<"options">, done?: string) {
    const before = items;
    setItems((all) => all.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const { error } = await db().update(dbPatch).eq("id", id).select("id").single();
    if (error) {
      setItems(before);
      toast({ message: friendlyError(error, "save the change") });
      return false;
    }
    if (done) toast({ message: done });
    router.refresh();
    return true;
  }

  async function move(id: string, dir: -1 | 1) {
    const i = active.findIndex((o) => o.id === id);
    const j = i + dir;
    if (j < 0 || j >= active.length) return;
    const a = active[i], b = active[j];
    const before = items;
    setItems((all) => all.map((o) => (o.id === a.id ? { ...o, sortOrder: b.sortOrder } : o.id === b.id ? { ...o, sortOrder: a.sortOrder } : o)));
    const [r1, r2] = await Promise.all([
      db().update({ sort_order: b.sortOrder }).eq("id", a.id),
      db().update({ sort_order: a.sortOrder === b.sortOrder ? a.sortOrder + dir : a.sortOrder }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      setItems(before);
      toast({ message: friendlyError(r1.error ?? r2.error, "reorder") });
    } else router.refresh();
  }

  async function setDefault(id: string) {
    const current = items.find((o) => o.isDefault);
    const before = items;
    setItems((all) => all.map((o) => ({ ...o, isDefault: o.id === id })));
    // One default per kind is enforced by a unique index: clear the old one first.
    if (current) {
      const r = await db().update({ is_default: false }).eq("id", current.id);
      if (r.error) {
        setItems(before);
        return toast({ message: friendlyError(r.error, "change the default") });
      }
    }
    const r = await db().update({ is_default: true }).eq("id", id);
    if (r.error) {
      setItems(before);
      return toast({ message: friendlyError(r.error, "change the default") });
    }
    router.refresh();
  }

  async function add() {
    const last = active[active.length - 1];
    const { data, error } = await db()
      .insert({
        organization_id: org.id,
        kind: section.kind,
        name: `New option ${items.length + 1}`,
        color: "#6E6E76",
        category: section.categories?.[0]?.value ?? null,
        rank: section.ranked ? (last?.rank ?? 0) + 1 : null,
        sort_order: (last?.sortOrder ?? 0) + 1,
      })
      .select("id, kind, name, color, category, rank, sort_order, is_default, is_active")
      .single();
    if (error || !data) return toast({ message: friendlyError(error, "add the option") });
    setItems((all) => [
      ...all,
      { id: data.id, kind: section.kind, name: data.name, color: data.color, category: data.category, rank: data.rank, sortOrder: data.sort_order, isDefault: false, isActive: true },
    ]);
    setEditing(data.id);
    router.refresh();
  }

  async function remove(o: Option) {
    const before = items;
    setItems((all) => all.filter((x) => x.id !== o.id));
    const { error } = await db().delete().eq("id", o.id).select("id").single();
    if (error) {
      setItems(before);
      toast({ message: friendlyError(error, "delete the option") });
    } else router.refresh();
  }

  const marker = (o: Option) =>
    isWorkflow ? (
      <StatusIcon status={o} glyph={config.glyph(o.id)} />
    ) : section.kind === "task_priority" ? (
      <PriorityIcon priority={o} />
    ) : (
      <span className="size-3.5 rounded-full" style={{ background: o.color }} />
    );

  const cols = cn(
    "grid items-center gap-3 px-3.5",
    section.categories
      ? "grid-cols-[20px_18px_minmax(0,1fr)_40px] lg:grid-cols-[20px_18px_minmax(0,1fr)_150px_100px_60px_40px]"
      : "grid-cols-[20px_18px_minmax(0,1fr)_40px] lg:grid-cols-[20px_18px_minmax(0,1fr)_100px_60px_40px]",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">{section.label}</h1>
          <p className="text-base leading-normal text-ink-3">
            {section.description} Applies to every project in <span className="font-medium text-ink">{org.name}</span>.
          </p>
        </div>
        {editable ? <Button variant="primary" onClick={add} className="max-lg:h-11"><Plus aria-hidden className="size-[15px]" strokeWidth={2} />Add</Button> : null}
      </div>

      {section.kind === "task_status" ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
          <span className="mr-1 font-medium text-ink-2">Workflow</span>
          {active.filter((o) => o.category !== "blocked").map((o, i, a) => (
            <span key={o.id} className="flex items-center gap-1.5">
              <span className="rounded border border-line bg-surface px-2 py-0.5 text-ink">{o.name}</span>
              {i < a.length - 1 ? <span aria-hidden className="text-ink-6">→</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className={cn(cols, "hidden h-[34px] bg-sunken text-xs font-medium text-ink-4 lg:grid")}>
          <span /><span /><span>Name</span>{section.categories ? <span>Counts as</span> : null}<span>Used by</span><span>Default</span><span />
        </div>
        {active.map((o) => (
          <div key={o.id} className={cn(cols, "min-h-[46px] border-t border-line-soft py-1.5 first:border-t-0 lg:first:border-t")}>
            <GripVertical aria-hidden className="size-4 text-ink-6 max-lg:invisible" />
            {marker(o)}
            {editing === o.id ? (
              <Input
                autoFocus
                aria-label="Name"
                defaultValue={o.name}
                maxLength={40}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  setEditing(null);
                  if (name && name !== o.name) void change(o.id, { name }, { name });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{section.kind === "issue_severity" ? <SeverityBadge severity={o} /> : o.name}</span>
                <span className="text-xs text-ink-4 lg:hidden">
                  {section.categories ? `${section.categories.find((c) => c.value === o.category)?.label} · ` : ""}
                  {usage[o.id] ?? 0} in use{o.isDefault ? " · default" : ""}
                </span>
              </span>
            )}
            {section.categories ? (
              <span className="hidden lg:block">
                {editable ? (
                  <Select
                    aria-label={`${o.name} counts as`}
                    value={o.category ?? ""}
                    onChange={(e) => change(o.id, { category: e.target.value }, { category: e.target.value })}
                    className="h-7 text-[12.5px]"
                  >
                    {section.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                ) : section.categories.find((c) => c.value === o.category)?.label}
              </span>
            ) : null}
            <span className="hidden text-[12.5px] text-ink-3 tabular lg:block">{usage[o.id] ?? 0} {usage[o.id] === 1 ? "record" : "records"}</span>
            <span className="hidden lg:flex">
              <input type="radio" name={`default-${section.kind}`} aria-label={`Default: ${o.name}`} checked={o.isDefault} disabled={!editable} onChange={() => setDefault(o.id)} className="size-4 accent-accent" />
            </span>
            {editable ? (
              <Menu>
                <MenuTrigger aria-label={`Actions for ${o.name}`} className="inline-flex size-8 items-center justify-center justify-self-end rounded-md text-ink-4 hover:bg-subtle max-lg:size-11">
                  <span aria-hidden className="text-lg leading-none">⋯</span>
                </MenuTrigger>
                <MenuContent align="end" label={`${o.name} actions`}>
                  <MenuItem onSelect={() => setEditing(o.id)}>Rename</MenuItem>
                  <MenuItem onSelect={() => move(o.id, -1)}><ArrowUp aria-hidden className="size-3.5 text-ink-4" />Move up</MenuItem>
                  <MenuItem onSelect={() => move(o.id, 1)}><ArrowDown aria-hidden className="size-3.5 text-ink-4" />Move down</MenuItem>
                  {!o.isDefault ? <MenuItem onSelect={() => setDefault(o.id)}>Make default</MenuItem> : null}
                  <MenuSeparator />
                  <div className="flex flex-wrap gap-1.5 px-2 py-1.5" role="group" aria-label="Colour">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Colour ${c}`}
                        aria-pressed={o.color === c}
                        onClick={() => change(o.id, { color: c }, { color: c })}
                        className={cn("size-5 rounded-full", o.color === c && "ring-2 ring-accent ring-offset-2")}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <MenuSeparator />
                  {(usage[o.id] ?? 0) > 0 || o.isDefault ? (
                    <MenuItem destructive onSelect={() => setConfirm(o)}>Archive…</MenuItem>
                  ) : (
                    <MenuItem destructive onSelect={() => remove(o)}>Delete</MenuItem>
                  )}
                </MenuContent>
              </Menu>
            ) : <span />}
          </div>
        ))}
      </div>

      {archived.length ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-2">Archived <span className="font-normal text-ink-4">{archived.length}</span></h2>
          {archived.map((o) => (
            <div key={o.id} className="flex min-h-[46px] items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-1.5">
              <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-ink-6" />
              <span className="font-medium text-ink-3">{o.name}</span>
              <span className="grow text-[12.5px] text-ink-4">Still shown on {usage[o.id] ?? 0} older records · can’t be picked for new ones</span>
              {editable ? <Button size="sm" onClick={() => change(o.id, { isActive: true }, { is_active: true }, `“${o.name}” restored`)}>Restore</Button> : null}
            </div>
          ))}
        </div>
      ) : null}

      <p role="note" className="flex max-w-2xl items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-sm leading-normal text-ink-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
        An option that records still use can’t be deleted, only archived. Existing records keep it; it just stops appearing in pickers.
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Archive “${confirm?.name}”?`}
        actionLabel="Archive"
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.isDefault) return toast({ message: "Make another option the default first." });
          void change(confirm.id, { isActive: false }, { is_active: false }, `“${confirm.name}” archived`);
        }}
      >
        <p>
          {usage[confirm?.id ?? ""] ?? 0} records use it. They keep it and stay readable; it won’t be offered for new ones. You can restore it any time.
        </p>
      </ConfirmDialog>
    </div>
  );
}
