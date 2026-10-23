// Public facts about the site, shared by metadata, the sitemap and structured data.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pm.mshinan.com").replace(/\/+$/, "");
export const SITE_NAME = "mso-pm";
export const SITE_TITLE = "mso-pm · Free project management tool for software teams";
export const SITE_DESCRIPTION =
  "Free project management for software studios and teams: boards, tasks, issues, releases, clients, docs and team chat across all your organizations, with roles and private-by-default data.";
export const SITE_KEYWORDS = [
  "free project management tool",
  "project management software",
  "free task management",
  "kanban board",
  "issue tracker",
  "bug tracker",
  "release management",
  "team chat",
  "project management for software teams",
  "agency project management",
  "client management",
];
