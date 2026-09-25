// Helpers over an organization's configurable options. Pure functions, usable
// from server and client components.

import type { Option, OptionKind } from "./types";

/** How a status icon is drawn. Derived from category + position, never from the name,
 *  so an organization's renamed or custom workflow still gets sensible icons. */
export type StatusGlyph =
  | { shape: "empty"; dashed: boolean }
  | { shape: "pie"; fraction: number }
  | { shape: "blocked" }
  | { shape: "done" };

export interface OrgConfig {
  byId: Map<string, Option>;
  /** Active options of a kind, in order — what pickers and board columns show. */
  ofKind: (kind: OptionKind) => Option[];
  /** Including archived ones — for settings and for labelling old records. */
  allOfKind: (kind: OptionKind) => Option[];
  get: (id: string | null | undefined) => Option | undefined;
  glyph: (statusId: string) => StatusGlyph;
}

export function buildConfig(options: Option[]): OrgConfig {
  const byId = new Map(options.map((o) => [o.id, o]));
  const kinds = new Map<OptionKind, Option[]>();
  for (const o of [...options].sort((a, b) => a.sortOrder - b.sortOrder)) {
    kinds.set(o.kind, [...(kinds.get(o.kind) ?? []), o]);
  }
  const allOfKind = (kind: OptionKind) => kinds.get(kind) ?? [];
  const ofKind = (kind: OptionKind) => allOfKind(kind).filter((o) => o.isActive);

  const glyphs = new Map<string, StatusGlyph>();
  for (const kind of ["task_status", "issue_status"] as const) {
    const list = allOfKind(kind);
    const active = list.filter((o) => o.category === "active");
    const notStarted = list.filter((o) => o.category === "not_started" || o.category === "open");
    for (const o of list) {
      let g: StatusGlyph;
      if (o.category === "blocked") g = { shape: "blocked" };
      else if (o.category === "completed" || o.category === "resolved" || o.category === "closed") g = { shape: "done" };
      else if (o.category === "active") g = { shape: "pie", fraction: (active.indexOf(o) + 1) / (active.length + 1) };
      // For tasks, the first of several "not started" states (Backlog before Todo) is dashed.
      else g = { shape: "empty", dashed: kind === "task_status" && notStarted.length > 1 && notStarted.indexOf(o) === 0 };
      glyphs.set(o.id, g);
    }
  }

  return {
    byId,
    ofKind,
    allOfKind,
    get: (id) => (id ? byId.get(id) : undefined),
    glyph: (id) => glyphs.get(id) ?? { shape: "empty", dashed: false },
  };
}

/** Soft background + readable ink derived from an option colour. */
export function tone(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 13%, white)`,
    color: `color-mix(in srgb, ${color} 78%, black)`,
  };
}
