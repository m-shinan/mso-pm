"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { Count, Kbd } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isActive, PRIMARY_NAV, SETTINGS_NAV, WORKSPACE_NAV, type NavItem } from "./nav";
import { useOrg } from "./org-provider";
import { OrgSwitcher } from "./org-switcher";
import { openSearch } from "./command-palette";

export interface NavCounts {
  myTasks: number;
  projects: number;
  openIssues: number;
  criticalIssues: number;
  chatUnread: number;
}

function NavLink({ item, count, extra }: { item: NavItem; count?: number; extra?: React.ReactNode }) {
  const { org, href } = useOrg();
  const pathname = usePathname();
  const active = isActive(pathname, org.slug, item.path);
  const Icon = item.icon;
  return (
    <Link
      href={href(item.path)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-base",
        active ? "bg-muted font-medium text-ink" : "text-ink-2 hover:bg-subtle",
      )}
    >
      <Icon aria-hidden className={cn("size-4", active ? "text-ink" : "text-ink-4")} strokeWidth={1.7} />
      <span className="grow">{item.label}</span>
      {extra}
      {count ? <span className="text-xs font-normal text-ink-4 tabular">{count}</span> : null}
    </Link>
  );
}

export function Sidebar({ counts }: { counts: NavCounts }) {
  const { projects, href } = useOrg();
  const pinned = projects.filter((p) => p.pinned);

  return (
    <aside className="hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-sunken lg:flex">
      <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
        <OrgSwitcher />
        <button
          type="button"
          onClick={openSearch}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-4 hover:bg-sunken"
        >
          <Search aria-hidden className="size-[15px]" />
          <span className="grow text-left">Search</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      <nav aria-label="Main" className="flex min-h-0 grow flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 py-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.path}
            item={item}
            count={item.path === "/my-tasks" ? counts.myTasks : undefined}
            extra={item.path === "/chat" && counts.chatUnread ? <Count>{counts.chatUnread}</Count> : undefined}
          />
        ))}
        <p className="px-2.5 pt-4 pb-1.5 text-xs font-medium text-ink-4">Workspace</p>
        {WORKSPACE_NAV.map((item) => (
          <NavLink
            key={item.path}
            item={item}
            count={item.path === "/projects" ? counts.projects : item.path === "/issues" ? counts.openIssues : undefined}
            extra={item.path === "/issues" && counts.criticalIssues ? <Count tone="danger">{counts.criticalIssues}</Count> : undefined}
          />
        ))}
        {pinned.length > 0 && (
          <>
            <p className="px-2.5 pt-4 pb-1.5 text-xs font-medium text-ink-4">Pinned</p>
            {pinned.map((p) => (
              <Link key={p.id} href={href(`/projects/${p.key.toLowerCase()}`)} className="flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-subtle">
                <span aria-hidden className="inline-flex size-4 items-center justify-center rounded bg-subtle text-[9.5px] font-semibold text-ink-2">
                  {p.name[0]}
                </span>
                <span className="grow truncate">{p.name}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 py-2">
        <NavLink item={SETTINGS_NAV} />
      </div>
      <div className="border-t border-line px-1.5 py-1.5">
        <AccountMenu />
      </div>
    </aside>
  );
}
