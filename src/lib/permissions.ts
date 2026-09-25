// The one place permission keys exist in the app. Roles are data (roles.permissions
// in the database, seeded by private.seed_org); RLS enforces the same keys.
// UI checks here are convenience only.

export const PERMISSIONS = [
  "projects.read_all",
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
  "docs.edit",
  "members.invite",
  "members.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "projects.read_all": "See every project",
  "projects.create": "Create projects",
  "projects.update": "Edit projects and their members",
  "projects.delete": "Delete archived projects",
  "tasks.create": "Create tasks",
  "tasks.update": "Edit tasks, comment",
  "tasks.delete": "Delete tasks",
  "tasks.assign": "Assign tasks",
  "issues.create": "Report issues",
  "issues.update": "Edit issues",
  "issues.delete": "Delete issues",
  "releases.manage": "Manage releases and milestones",
  "clients.manage": "Manage clients",
  "docs.edit": "Edit documents",
  "members.invite": "Invite people",
  "members.manage": "Change roles, remove members",
  "settings.manage": "Organization settings",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  project_manager: "Project manager",
  developer: "Developer",
  viewer: "Viewer",
};

export function can(granted: readonly string[], permission: Permission): boolean {
  return granted.includes(permission);
}
