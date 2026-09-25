// The one place permission keys exist. Roles are data (a list of keys stored on
// the roles table); these defaults are what a new organization is seeded with.
// UI checks are convenience only — RLS enforces the same keys in the database.

import type { RoleKey } from "./types";

export const PERMISSIONS = [
  "projects.read",
  "projects.create",
  "projects.update",
  "projects.delete",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.assign",
  "issues.create",
  "issues.update",
  "issues.delete",
  "releases.manage",
  "clients.manage",
  "members.invite",
  "members.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const WORK: Permission[] = ["tasks.create", "tasks.update", "issues.create", "issues.update"];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  project_manager: [
    "projects.read", "projects.create", "projects.update",
    ...WORK, "tasks.delete", "tasks.assign", "issues.delete",
    "releases.manage", "clients.manage", "members.invite",
  ],
  developer: ["projects.read", ...WORK],
  viewer: ["projects.read"],
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  owner: "Owner",
  admin: "Admin",
  project_manager: "Project manager",
  developer: "Developer",
  viewer: "Viewer",
};

export function permissionsFor(role: RoleKey): readonly Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role];
}

export function can(granted: readonly Permission[], permission: Permission): boolean {
  return granted.includes(permission);
}
