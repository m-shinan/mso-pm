import Link from "next/link";
import type { ReactNode } from "react";
import { NotificationBell } from "./notification-bell";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Desktop top bar. The organization is always the first crumb so it is never
 * ambiguous which company's data is on screen.
 */
export function PageHeader({ orgName, crumbs, actions }: { orgName: string; crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="hidden h-[52px] shrink-0 items-center justify-between border-b border-line bg-surface px-8 lg:flex">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-base">
          <li className="text-ink-3">{orgName}</li>
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span aria-hidden className="text-ink-6">/</span>
              {c.href ? (
                <Link href={c.href} className="text-ink-3 hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex items-center gap-2">
        <NotificationBell />
        {actions}
      </div>
    </header>
  );
}

/** Page title block used at the top of content on every screen size. */
export function PageTitle({ title, eyebrow, children }: { title: ReactNode; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5 lg:gap-1">
        {eyebrow ? <span className="text-sm text-ink-3">{eyebrow}</span> : null}
        <h1 className="text-2xl font-semibold tracking-[-0.01em] max-lg:text-[24px]">{title}</h1>
      </div>
      {children}
    </div>
  );
}
