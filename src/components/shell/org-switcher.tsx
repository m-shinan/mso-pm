"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronsUpDown, Plus, SlidersHorizontal } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Organization } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOrg } from "./org-provider";

export function OrgLogo({ org, size = 26 }: { org: Pick<Organization, "name" | "logoColor">; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white"
      style={{ background: org.logoColor, width: size, height: size, fontSize: size * 0.5 }}
    >
      {org.name[0]}
    </span>
  );
}

/** Switching org goes to that org's dashboard. proxy.ts remembers it for the next visit. */
export function OrgSwitcher({ compact }: { compact?: boolean }) {
  const { org, orgs } = useOrg();
  const router = useRouter();

  function go(slug: string) {
    router.push(`/${slug}`);
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Organization: ${org.name}. Switch organization`}
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-left",
          compact
            ? "h-11 px-2 hover:bg-subtle"
            : "h-11 w-full border border-line bg-surface px-2 hover:bg-sunken",
        )}
      >
        <OrgLogo org={org} size={compact ? 28 : 26} />
        {compact ? (
          <>
            <span className="text-lg font-semibold">{org.name}</span>
            <ChevronDown aria-hidden className="size-4 text-ink-4" />
          </>
        ) : (
          <>
            <span className="flex min-w-0 grow flex-col leading-tight">
              <span className="truncate text-base font-semibold">{org.name}</span>
              <span className="text-2xs text-ink-4">
                {ROLE_LABELS[org.role]} · {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
              </span>
            </span>
            <ChevronsUpDown aria-hidden className="size-4 text-ink-4" />
          </>
        )}
      </MenuTrigger>
      <MenuContent label="Switch organization" className="w-[240px]">
        <MenuLabel>Your organizations</MenuLabel>
        {orgs.map((o) => (
          <MenuItem key={o.id} onSelect={() => go(o.slug)} className={o.id === org.id ? "bg-subtle" : undefined}>
            <OrgLogo org={o} size={20} />
            <span className={cn("grow", o.id === org.id && "font-medium")}>{o.name}</span>
            {o.id === org.id ? (
              <Check aria-label="Current" className="size-3.5 text-accent" strokeWidth={2.4} />
            ) : (
              <span className="text-2xs text-ink-4">{ROLE_LABELS[o.role]}</span>
            )}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/onboarding")} className="text-ink-2">
          <Plus aria-hidden className="size-4 text-ink-4" /> Create organization
        </MenuItem>
        <MenuItem onSelect={() => router.push(`/${org.slug}/settings`)} className="text-ink-2">
          <SlidersHorizontal aria-hidden className="size-4 text-ink-4" /> Manage organizations
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
