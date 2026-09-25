"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOrg } from "@/components/shell/org-provider";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OPTION_SECTIONS, OTHER_SECTIONS } from "./sections";

const GROUPS = [
  { title: "Organization", items: OTHER_SECTIONS },
  { title: "Workflow", items: [...OPTION_SECTIONS.map((s) => ({ slug: s.slug, label: s.label })), { slug: "labels", label: "Labels" }] },
];

/** Side list on desktop, a single picker on phones. */
export function SettingsNav() {
  const { href } = useOrg();
  const pathname = usePathname();
  const router = useRouter();
  const current = pathname.split("/").pop();

  return (
    <>
      <div className="px-4 pt-4 lg:hidden">
        <Select aria-label="Settings section" value={current} onChange={(e) => router.push(href(`/settings/${e.target.value}`))}>
          {GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
            </optgroup>
          ))}
        </Select>
      </div>
      <nav aria-label="Settings" className="hidden w-[220px] shrink-0 flex-col gap-px border-r border-line px-3 py-5 lg:flex">
        {GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-px">
            <p className="px-2.5 pt-3 pb-1.5 text-xs font-medium text-ink-4">{g.title}</p>
            {g.items.map((i) => {
              const active = current === i.slug;
              return (
                <Link
                  key={i.slug}
                  href={href(`/settings/${i.slug}`)}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-[30px] items-center rounded-md px-2.5 text-sm", active ? "bg-muted font-medium text-ink" : "text-ink-2 hover:bg-subtle")}
                >
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
