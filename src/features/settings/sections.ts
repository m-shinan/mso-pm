import type { OptionKind } from "@/lib/types";

export interface OptionSection {
  slug: string;
  label: string;
  kind: OptionKind;
  description: string;
  /** Categories an option of this kind can have (drives "Counts as"). */
  categories?: { value: string; label: string }[];
  ranked?: boolean;
}

export const OPTION_SECTIONS: OptionSection[] = [
  { slug: "project-types", label: "Project types", kind: "project_type", description: "Kinds of work you take on. Used to group and filter projects." },
  {
    slug: "project-statuses", label: "Project statuses", kind: "project_status",
    description: "Where a project is in its life. “Counts as” decides whether it shows as active on the dashboard.",
    categories: [
      { value: "planned", label: "Planned" }, { value: "active", label: "Active" },
      { value: "paused", label: "Paused" }, { value: "completed", label: "Completed" },
    ],
  },
  {
    slug: "task-statuses", label: "Task statuses", kind: "task_status",
    description: "The board columns for every project, in board order. “Counts as” is what progress and overdue numbers use, so renaming a status never breaks them.",
    categories: [
      { value: "not_started", label: "Not started" }, { value: "active", label: "Active" },
      { value: "blocked", label: "Blocked" }, { value: "completed", label: "Completed" },
    ],
  },
  { slug: "priorities", label: "Priorities", kind: "task_priority", description: "Shared by tasks and issues. Order matters: the top one is the most urgent.", ranked: true },
  {
    slug: "issue-statuses", label: "Issue statuses", kind: "issue_status", description: "The lifecycle of a bug report.",
    categories: [
      { value: "open", label: "Open" }, { value: "active", label: "Being worked on" },
      { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" },
    ],
  },
  { slug: "issue-severities", label: "Issue severities", kind: "issue_severity", description: "How bad a bug is. Order matters: the top one is the most severe.", ranked: true },
  {
    slug: "release-statuses", label: "Release statuses", kind: "release_status", description: "Stages a release moves through.",
    categories: [{ value: "planned", label: "Planned" }, { value: "active", label: "In progress" }, { value: "released", label: "Released" }],
  },
];

export const OTHER_SECTIONS = [
  { slug: "general", label: "General" },
  { slug: "members", label: "Members" },
  { slug: "roles", label: "Roles & permissions" },
];
