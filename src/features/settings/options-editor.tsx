"use client";

import { ArrowDown, ArrowUp, GripVertical, Info, Plus } from "lucide-react";
import { useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm";
import { PriorityIcon, SeverityBadge, StatusIcon } from "@/components/domain/markers";
import { buildConfig } from "@/lib/options";
import type { Option } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { OptionSection } from "./sections";

/**
 * Add, rename, reorder, set default, archive/restore. Options that records use
 * are archived, never deleted, so history stays readable.
 * Phase 2 persists each change with one small update (no full reload).
 */
export function OptionsEditor({ section, initial }: { section: OptionSection; initial: Option[] }) {
  const { org, can } = useOrg();
  const toast = useToast();
  const editable = can("settings.manage");
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Option | null>(null);
  const active = items.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const archived = items.filter((o) => !o.isActive);
  const config = buildConfig(items);
  const isStatus = section.kind.endsWith("status");

  const update = (id: string, patch: Partial<Option>) => setItems((all) => all.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  function move(id: string, dir: -1 | 1) {
    const i = active.findIndex((o) => o.id === id);
    const j = i + dir;
    if (j < 0 || j >= active.length) return;
    const a = active[i], b = active[j];
    setItems((all) => all.map((o) => (o.id === a.id ? { ...o, sortOrder: b.sortOrder } : o.id === b.id ? { ...o, sortOrder: a.sortOrder } : o)));
  }
  function setDefault(id: string) {
    setItems((all) => all.map((o) => ({ ...o, isDefault: o.id === id })));
  }
  function archive(o: Option) {
    update(o.id, { isActive: false, isDefault: false });
    toast({ message: `“${o.name}” archived`, action: { label: "Undo", onClick: () => update(o.id, { isActive: true }) } });
  }
  function add() {
    const id = `new_${Date.now()}`;
    const last = active[active.length - 1];
    setItems((all) => [
      ...all,
      { id, kind: section.kind, name: "New option", color: "#6E6E76", category: section.categories?.[0]?.value ?? null, rank: section.ranked ? (last?.rank ?? 0) + 1 : null, sortOrder: (last?.sortOrder ?? 0) + 1, isDefault: false, isActive: true, usage: 0 },
    ]);
    setEditing(id);
  }

  const marker = (o: Option) =>
    isStatus && section.kind !== "project_status" && section.kind !== "release_status" ? (
      <StatusIcon status={o} glyph={config.glyph(o.id)} />
    ) : section.kind === "task_priority" ? (
      <PriorityIcon priority={o} />
    ) : (
      <span className="size-3.5 rounded-full" style={{ background: o.color }} />
    );

  const cols = cn(
    "grid items-center gap-3 px-3.5",
    section.categories ? "grid-cols-[20px_18px_minmax(0,1fr)_32px] lg:grid-cols-[20px_18px_minmax(0,1fr)_150px_110px_70px_32px]" : "grid-cols-[20px_18px_minmax(0,1fr)_32px] lg:grid-cols-[20px_18px_minmax(0,1fr)_110px_70px_32px]",
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
            {/* Drag reordering arrives with dnd-kit; the menu's Move up/down keeps it keyboard-accessible. */}
            <GripVertical aria-hidden className="size-4 text-ink-6 max-lg:invisible" />
            {marker(o)}
            {editing === o.id ? (
              <Input
                autoFocus
                aria-label="Name"
                defaultValue={o.name}
                onBlur={(e) => { update(o.id, { name: e.target.value.trim() || o.name }); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(null); }}
              />
            ) : (
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{section.kind === "issue_severity" ? <SeverityBadge severity={o} /> : o.name}</span>
                <span className="text-xs text-ink-4 lg:hidden">
                  {section.categories ? `${section.categories.find((c) => c.value === o.category)?.label} · ` : ""}
                  {o.usage ?? 0} in use{o.isDefault ? " · default" : ""}
                </span>
              </span>
            )}
            {section.categories ? (
              <span className="hidden lg:block">
                {editable ? (
                  <Select aria-label={`${o.name} counts as`} value={o.category ?? ""} onChange={(e) => update(o.id, { category: e.target.value })} className="h-7 text-[12.5px]">
                    {section.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                ) : section.categories.find((c) => c.value === o.category)?.label}
              </span>
            ) : null}
            <span className="hidden text-[12.5px] text-ink-3 tabular lg:block">{o.usage ?? 0} {o.usage === 1 ? "record" : "records"}</span>
            <span className="hidden lg:flex">
              <input type="radio" name={`default-${section.kind}`} aria-label={`Default: ${o.name}`} checked={o.isDefault} disabled={!editable} onChange={() => setDefault(o.id)} className="size-4 accent-accent" />
            </span>
            {editable ? (
              <Menu>
                <MenuTrigger aria-label={`Actions for ${o.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-ink-4 hover:bg-subtle max-lg:size-11">
                  <span aria-hidden className="text-lg leading-none">⋯</span>
                </MenuTrigger>
                <MenuContent align="end" label={`${o.name} actions`}>
                  <MenuItem onSelect={() => setEditing(o.id)}>Rename</MenuItem>
                  <MenuItem onSelect={() => move(o.id, -1)}><ArrowUp aria-hidden className="size-3.5 text-ink-4" />Move up</MenuItem>
                  <MenuItem onSelect={() => move(o.id, 1)}><ArrowDown aria-hidden className="size-3.5 text-ink-4" />Move down</MenuItem>
                  {!o.isDefault ? <MenuItem onSelect={() => setDefault(o.id)}>Make default</MenuItem> : null}
                  <MenuSeparator />
                  {(o.usage ?? 0) > 0 ? (
                    <MenuItem destructive onSelect={() => setConfirm(o)}>Archive…</MenuItem>
                  ) : (
                    <MenuItem destructive onSelect={() => setItems((all) => all.filter((x) => x.id !== o.id))}>Delete</MenuItem>
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
              <span className="size-3.5 rounded-full border-[1.5px] border-ink-6" />
              <span className="font-medium text-ink-3">{o.name}</span>
              <span className="grow text-[12.5px] text-ink-4">Still shown on {o.usage ?? 0} older records · can’t be picked for new ones</span>
              {editable ? <Button size="sm" onClick={() => update(o.id, { isActive: true })}>Restore</Button> : null}
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
        onConfirm={() => confirm && archive(confirm)}
      >
        <p>{confirm?.usage} records use it. They keep it and stay readable; it won’t be offered for new {section.kind.startsWith("issue") ? "issues" : section.kind.startsWith("project") ? "projects" : "items"}. You can restore it any time.</p>
      </ConfirmDialog>
    </div>
  );
}
