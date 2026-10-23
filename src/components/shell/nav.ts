import {
  Activity,
  Briefcase,
  Bug,
  CalendarDays,
  CircleCheck,
  FileText,
  Folder,
  LayoutGrid,
  MessagesSquare,
  SlidersHorizontal,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { path: "", label: "Dashboard", icon: LayoutGrid },
  { path: "/my-tasks", label: "My tasks", icon: CircleCheck },
  { path: "/chat", label: "Chat", icon: MessagesSquare },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/activity", label: "Activity", icon: Activity },
];

export const WORKSPACE_NAV: NavItem[] = [
  { path: "/projects", label: "Projects", icon: Folder },
  { path: "/issues", label: "Issues", icon: Bug },
  { path: "/releases", label: "Releases", icon: Tag },
  { path: "/docs", label: "Documents", icon: FileText },
  { path: "/clients", label: "Clients", icon: Briefcase },
  { path: "/team", label: "Team", icon: Users },
];

export const SETTINGS_NAV: NavItem = { path: "/settings", label: "Settings", icon: SlidersHorizontal };

/** Is `path` (relative to the org) the active section for the current pathname? */
export function isActive(pathname: string, orgSlug: string, path: string) {
  const base = `/${orgSlug}${path}`;
  if (path === "") return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}
