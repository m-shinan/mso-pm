// Pure logic: status glyphs from categories, due labels, activity sentences, errors, permissions.
import { describe, expect, it } from "vitest";
import { describeActivity } from "@/lib/activity";
import { HOME, safeNext, SESSION_MAX_AGE_SECONDS, sessionExpired } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { daysFromToday, dueLabel, formatDate, percent } from "@/lib/format";
import { buildConfig } from "@/lib/options";
import { initialsOf, tintFor } from "@/lib/people";
import { can, PERMISSIONS } from "@/lib/permissions";
import type { Option } from "@/lib/types";

const opt = (id: string, name: string, category: string, sortOrder: number, isActive = true): Option => ({
  id, kind: "task_status", name, color: "#000000", category, rank: null, sortOrder, isDefault: false, isActive,
});

const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("status glyphs follow category and order, not names", () => {
  const config = buildConfig([
    opt("a", "Ideas", "not_started", 0),
    opt("b", "Todo", "not_started", 1),
    opt("c", "Development", "active", 2),
    opt("d", "Code review", "active", 3),
    opt("e", "QA", "active", 4),
    opt("f", "Waiting", "blocked", 5),
    opt("g", "Shipped", "completed", 6),
    opt("h", "Old", "active", 7, false),
  ]);

  it("dashes the first of several not-started statuses", () => {
    expect(config.glyph("a")).toEqual({ shape: "empty", dashed: true });
    expect(config.glyph("b")).toEqual({ shape: "empty", dashed: false });
  });
  it("fills active statuses progressively", () => {
    const f = ["c", "d", "e"].map((id) => (config.glyph(id) as { fraction: number }).fraction);
    expect(f[0]).toBeLessThan(f[1]);
    expect(f[1]).toBeLessThan(f[2]);
  });
  it("marks blocked and completed", () => {
    expect(config.glyph("f").shape).toBe("blocked");
    expect(config.glyph("g").shape).toBe("done");
  });
  it("pickers hide archived options; lookups still find them", () => {
    expect(config.ofKind("task_status").map((o) => o.id)).not.toContain("h");
    expect(config.allOfKind("task_status").map((o) => o.id)).toContain("h");
    expect(config.get("h")?.name).toBe("Old");
  });
});

describe("dates", () => {
  it("labels due dates relative to today", () => {
    expect(dueLabel(iso(0))).toEqual({ text: "Today", late: false });
    expect(dueLabel(iso(1))).toEqual({ text: "Tomorrow", late: false });
    expect(dueLabel(iso(-3))).toEqual({ text: "Overdue 3d", late: true });
    expect(dueLabel(null)).toEqual({ text: "No date", late: false });
    expect(daysFromToday(iso(5))).toBe(5);
  });
  it("formats with fixed three-letter months", () => {
    expect(formatDate("2026-09-27")).toBe("27 Sep");
    expect(formatDate("2026-09-27", { year: true })).toBe("27 Sep 2026");
  });
  it("percent handles empty projects", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
  });
});

describe("activity sentences", () => {
  const row = (action: string, changes: Record<string, unknown>) => ({
    id: 1, actor_id: "u", action, entity_type: "task", entity_label: "SKR-1", changes, project_id: null, created_at: new Date().toISOString(),
  });
  it("describes a status move", () => {
    expect(describeActivity(row("updated", { status: ["Todo", "Review"] }))).toMatchObject({ verb: "moved", subject: "SKR-1", detail: "to Review" });
  });
  it("describes an assignment and an unassignment", () => {
    expect(describeActivity(row("updated", { assignee: [null, "Aisha R."] }))).toMatchObject({ verb: "assigned", detail: "to Aisha R." });
    expect(describeActivity(row("updated", { assignee: ["Aisha R.", null] })).verb).toBe("unassigned");
  });
});

describe("errors never leak codes", () => {
  it("maps database errors to sentences", () => {
    expect(friendlyError({ code: "23505", message: "duplicate key value violates unique constraint \"projects_organization_id_key_key\"" })).toBe("Another project already uses that key.");
    expect(friendlyError({ code: "23503", message: "fk" })).toMatch(/still in use/);
    expect(friendlyError({ code: "42501", message: "new row violates row-level security policy" })).toBe("You don’t have permission to do that.");
    expect(friendlyError({ code: "XX000", message: "weird internal thing" }, "save the task")).toBe("Couldn’t save the task. Please try again.");
  });
});

describe("people and permissions", () => {
  it("initials and stable tints", () => {
    expect(initialsOf("Muhammed S.")).toBe("MS");
    expect(initialsOf("aisha")).toBe("AI");
    expect(tintFor("abc")).toEqual(tintFor("abc"));
  });
  it("permission checks are exact", () => {
    expect(can(["tasks.update"], "tasks.update")).toBe(true);
    expect(can(["tasks.update"], "tasks.delete")).toBe(false);
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });
});

describe("redirects after sign-in stay inside the app", () => {
  it("keeps in-app paths with their query and hash", () => {
    expect(safeNext("/acme/projects?tab=open#top")).toBe("/acme/projects?tab=open#top");
  });
  it("rejects anything that a browser would send off-site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "", null, undefined]) {
      expect(safeNext(bad), String(bad)).toBe(HOME);
    }
  });
});

describe("sessions end 30 days after sign-in", () => {
  const now = 1_800_000_000;
  const signedIn = (secondsAgo: number) => ({ amr: [{ method: "password", timestamp: now - secondsAgo }] });
  it("keeps a session inside the window and ends one past it", () => {
    expect(sessionExpired(signedIn(SESSION_MAX_AGE_SECONDS - 60), now)).toBe(false);
    expect(sessionExpired(signedIn(SESSION_MAX_AGE_SECONDS + 60), now)).toBe(true);
  });
  it("counts from the first sign-in method, not a later MFA step", () => {
    const claims = { amr: [{ method: "totp", timestamp: now - 60 }, { method: "password", timestamp: now - SESSION_MAX_AGE_SECONDS - 60 }] };
    expect(sessionExpired(claims, now)).toBe(true);
  });
  it("leaves tokens without amr alone", () => {
    expect(sessionExpired({}, now)).toBe(false);
    expect(sessionExpired(undefined, now)).toBe(false);
  });
});
