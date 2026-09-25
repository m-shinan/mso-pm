"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bug, Folder, LayoutGrid, Menu as MenuIcon, Plus, Search } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { isActive, PRIMARY_NAV, SETTINGS_NAV, WORKSPACE_NAV } from "./nav";
import { useOrg } from "./org-provider";
import { OrgSwitcher } from "./org-switcher";
import { openSearch } from "./command-palette";
import { openCreate } from "./quick-create";

/** Phone top bar: org switcher, search, notifications, account. */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-0.5 border-b border-line bg-surface pr-1.5 pl-3 lg:hidden">
      <OrgSwitcher compact />
      <span className="grow" />
      <button type="button" aria-label="Search" onClick={openSearch} className="inline-flex size-11 items-center justify-center rounded-lg text-ink-2">
        <Search aria-hidden className="size-5" />
      </button>
      <NotificationBell />
      <AccountMenu compact />
    </header>
  );
}

/** Phone bottom navigation. "More" holds the sections that don't fit. */
export function MobileBottomNav() {
  const { org, href } = useOrg();
  const pathname = usePathname();
  const router = useRouter();
  const tab = (path: string, label: string, Icon: typeof Folder) => {
    const active = isActive(pathname, org.slug, path);
    return (
      <Link
        href={href(path)}
        aria-current={active ? "page" : undefined}
        className={cn("flex h-[52px] flex-col items-center justify-center gap-[3px] text-2xs", active ? "font-medium text-ink" : "text-ink-4")}
      >
        <Icon aria-hidden className="size-[22px]" strokeWidth={1.8} />
        {label}
      </Link>
    );
  };
  const more = [...PRIMARY_NAV.slice(1), ...WORKSPACE_NAV.filter((i) => !["/projects", "/issues"].includes(i.path)), SETTINGS_NAV];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-line bg-surface px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] lg:hidden"
    >
      {tab("", "Today", LayoutGrid)}
      {tab("/projects", "Projects", Folder)}
      <button type="button" aria-label="Create" onClick={() => openCreate()} className="inline-flex size-12 items-center justify-center justify-self-center rounded-[14px] bg-accent text-white">
        <Plus aria-hidden className="size-[22px]" strokeWidth={2.2} />
      </button>
      {tab("/issues", "Issues", Bug)}
      <Menu>
        <MenuTrigger className="flex h-[52px] flex-col items-center justify-center gap-[3px] text-2xs text-ink-4">
          <MenuIcon aria-hidden className="size-[22px]" strokeWidth={1.8} />
          More
        </MenuTrigger>
        <MenuContent align="end" label="More sections" className="w-56">
          {more.map((item) => (
            <MenuItem key={item.path} onSelect={() => router.push(href(item.path))}>
              <item.icon aria-hidden className="size-[18px] text-ink-4" />
              {item.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </nav>
  );
}
