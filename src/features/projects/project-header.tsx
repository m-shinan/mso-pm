"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { EditProjectDialog, ProjectMembersDialog } from "./forms";
import type { ProjectDetail } from "./queries";
import { useToast } from "@/components/ui/toast";
import { useOrg } from "@/components/shell/org-provider";
import { AvatarStack } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { PriorityIcon, StatusPill } from "@/components/domain/markers";
import { daysFromToday, formatDate, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProjectHeader({ project }: { project: ProjectDetail }) {
  const { org, config, member, can, href, currentUserId } = useOrg();
  const toast = useToast();
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  async function archive() {
    const { error } = await supabaseBrowser()
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", project.id)
      .select("id")
      .single();
    if (error) return toast({ message: friendlyError(error, "archive the project") });
    toast({ message: `${project.name} archived` });
    router.replace(href("/projects"));
    router.refresh();
  }

  async function togglePin() {
    const db = supabaseBrowser().from("project_pins");
    const { error } = project.pinned
      ? await db.delete().eq("project_id", project.id).eq("user_id", currentUserId)
      : await db.insert({ project_id: project.id, organization_id: org.id, user_id: currentUserId });
    if (error) return toast({ message: friendlyError(error, "update your pins") });
    router.refresh();
  }
  const pct = percent(project.tasksDone, project.tasksTotal);
  const left = project.dueDate ? daysFromToday(project.dueDate) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-lg font-semibold text-ink-2">
          {project.name[0]}
        </span>
        <div className="flex min-w-0 grow flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{project.name}</h1>
            <span className="rounded border border-line px-[5px] font-mono text-2xs text-ink-3">{project.key}</span>
            <StatusPill option={config.get(project.statusId)} />
          </div>
          <p className="text-sm text-ink-3 max-lg:line-clamp-2">{project.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {can("projects.update") ? (
            <Button onClick={() => setEditOpen(true)} className="max-lg:hidden">Edit project</Button>
          ) : null}
          <Menu>
            <MenuTrigger aria-label="More actions" className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface hover:bg-sunken max-lg:size-11">
              <MoreHorizontal aria-hidden className="size-4 text-ink-2" />
            </MenuTrigger>
            <MenuContent align="end" label="Project actions">
              {can("projects.update") ? (
                <>
                  <MenuItem onSelect={() => setEditOpen(true)}>Edit project</MenuItem>
                  <MenuItem onSelect={() => setMembersOpen(true)}>People on this project</MenuItem>
                </>
              ) : null}
              <MenuItem onSelect={togglePin}>{project.pinned ? "Unpin from sidebar" : "Pin to sidebar"}</MenuItem>
              <MenuItem onSelect={() => { navigator.clipboard?.writeText(window.location.href); toast({ message: "Link copied" }); }}>Copy link</MenuItem>
              {can("projects.delete") ? (
                <>
                  <MenuSeparator />
                  <MenuItem destructive onSelect={() => setArchiveOpen(true)}>Archive project…</MenuItem>
                </>
              ) : null}
            </MenuContent>
          </Menu>
          <ConfirmDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            title={`Archive “${project.name}”?`}
            actionLabel="Archive project"
            confirmText={project.key}
            onConfirm={archive}
          >
            <p>It leaves the project lists, dashboard and search for everyone. Its {project.tasksTotal} tasks, issues and documents are kept, not deleted.</p>
          </ConfirmDialog>
          <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
          <ProjectMembersDialog project={project} open={membersOpen} onOpenChange={setMembersOpen} />
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Client</dt>
          <dd>{project.client ? <Link href={href(`/clients?client=${project.client.id}`)} className="text-accent hover:text-accent-hover">{project.client.name}</Link> : "Internal"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Type</dt>
          <dd>{config.get(project.typeId)?.name}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Priority</dt>
          <dd className="flex items-center gap-1.5"><PriorityIcon priority={config.get(project.priorityId)} />{config.get(project.priorityId)?.name}</dd>
        </div>
        <div className="flex flex-col gap-1 max-lg:hidden">
          <dt className="text-xs text-ink-4">Timeline</dt>
          <dd>
            {project.startDate ? formatDate(project.startDate) : "—"} → {project.dueDate ? formatDate(project.dueDate, { year: true }) : "no deadline"}
            {left !== null ? <span className={cn(left < 14 ? "text-late" : "text-ink-4")}> · {left >= 0 ? `${left} days left` : `${-left} days late`}</span> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Progress</dt>
          <dd className="flex items-center gap-2">
            <Progress value={pct} className="w-24" />
            {pct}% <span className="text-ink-4 max-lg:hidden">· {project.tasksDone} of {project.tasksTotal} tasks</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1 max-lg:hidden">
          <dt className="text-xs text-ink-4">Members</dt>
          <dd><AvatarStack people={project.memberIds.map((id) => member(id)!).filter(Boolean)} /></dd>
        </div>
      </dl>
    </div>
  );
}

const TABS = [
  { path: "", label: "Board" },
  { path: "/list", label: "List" },
  { path: "/issues", label: "Issues" },
  { path: "/milestones", label: "Milestones" },
  { path: "/releases", label: "Releases" },
  { path: "/activity", label: "Activity" },
];

export function ProjectTabs({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project sections" className="-mx-4 mt-4 flex gap-5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {TABS.map((t) => {
        const target = `${base}${t.path}`;
        const active = pathname === target;
        return (
          <Link
            key={t.path}
            href={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 pt-2 pb-2.5 text-base max-lg:pb-3 max-lg:text-md",
              active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
