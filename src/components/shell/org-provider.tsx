"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildConfig, type OrgConfig } from "@/lib/options";
import { can, type Permission } from "@/lib/permissions";
import type { Member, Organization } from "@/lib/types";
import type { OrgContextData } from "@/features/org/queries";

interface OrgContextValue extends Omit<OrgContextData, "options"> {
  org: Organization;
  orgs: Organization[];
  config: OrgConfig;
  member: (id: string | null | undefined) => Member | undefined;
  can: (p: Permission) => boolean;
  href: (path?: string) => string;
}

const Ctx = createContext<OrgContextValue | null>(null);

/** Org-wide data loaded once in the org layout and reused by every client component. */
export function OrgProvider({
  org,
  orgs,
  data,
  children,
}: {
  org: Organization;
  orgs: Organization[];
  data: OrgContextData;
  children: ReactNode;
}) {
  const value = useMemo<OrgContextValue>(() => {
    const byId = new Map(data.members.map((m) => [m.id, m]));
    return {
      ...data,
      org,
      orgs,
      config: buildConfig(data.options),
      member: (id) => (id ? byId.get(id) : undefined),
      can: (p) => can(data.permissions, p),
      href: (path = "") => `/${org.slug}${path}`,
    };
  }, [org, orgs, data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrg must be used inside OrgProvider");
  return v;
}
