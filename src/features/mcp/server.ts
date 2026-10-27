// MCP server: lets people use mso-pm from ChatGPT, Claude, Cursor and other MCP
// clients with their own mso-pm account. Clients sign in through Supabase Auth's
// OAuth 2.1 server (consent screen at /oauth/consent); every tool runs as that
// user, so RLS decides what they can read and change, and the usual triggers
// (numbering, activity, notifications) fire as if they used the app.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { pipeline } from "@supabase/middleware";
import { fromSupabaseUrl, withOAuthProtectedResource, withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { SITE_URL } from "@/lib/site";

type Db = SupabaseClient<Database>;
type Option = { id: string; kind: string; name: string; category: string | null; is_default: boolean };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Request handler for /api/mcp and its /oauth-protected-resource metadata route. */
export const handleMcp = pipeline(
  [
    withOAuthProtectedResource({
      resourceServer: (req) => new URL(req.url).origin + "/api/mcp",
      authorizationServer: fromSupabaseUrl(SUPABASE_URL),
    }),
    withSupabase<Database>({
      auth: "user",
      issuer: fromSupabaseUrl(SUPABASE_URL),
      env: {
        url: SUPABASE_URL,
        publishableKeys: { default: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        jwks: new URL(fromSupabaseUrl(SUPABASE_URL) + "/.well-known/jwks.json"),
      },
    }),
  ],
  async (req, { supabase, userClaims }) =>
    createMcpHandler(() => buildServer(supabase, userClaims!.id), {
      onerror: (error) => console.error("MCP request failed", error),
    }).fetch(req),
);

function buildServer(db: Db, me: string) {
  const server = new McpServer({ name: "mso-pm", version: "0.1.0" });
  const org = z.string().optional().describe("Organization slug (from list_organizations). Only needed when you belong to several organizations that use the same project key.");
  const key = z.string().regex(/^[A-Za-z][A-Za-z0-9]{1,5}-\d+$/).describe("Task key, e.g. WEB-41");

  server.registerTool(
    "list_organizations",
    {
      description: "List the mso-pm organizations the signed-in user belongs to.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { data, error } = await db.from("organizations").select("slug, name").is("archived_at", null).order("name");
      if (error) return fail(error.message);
      return ok(data);
    },
  );

  server.registerTool(
    "list_projects",
    {
      description: "List the projects the user can see, with their keys (used in task keys like WEB-41) and the status and priority names tasks can take.",
      inputSchema: z.object({ organization: org }),
      annotations: { readOnlyHint: true },
    },
    async ({ organization }) => {
      const orgs = await findOrgs(db, organization);
      if ("error" in orgs) return fail(orgs.error);
      const { data, error } = await db
        .from("projects")
        .select("key, name, description, organization_id")
        .in("organization_id", orgs.map((o) => o.id))
        .is("archived_at", null)
        .order("key");
      if (error) return fail(error.message);
      const result = [];
      for (const o of orgs) {
        const opts = await options(db, o.id);
        result.push({
          organization: o.slug,
          task_statuses: names(opts, "task_status"),
          task_priorities: names(opts, "task_priority"),
          projects: data.filter((p) => p.organization_id === o.id).map(({ key, name, description }) => ({ key, name, description })),
        });
      }
      return ok(result);
    },
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List tasks in a project, newest first. Completed tasks are left out unless asked for.",
      inputSchema: z.object({
        project: z.string().describe("Project key, e.g. WEB"),
        organization: org,
        status: z.string().optional().describe("Only tasks with this status name"),
        assigned_to_me: z.boolean().default(false),
        include_completed: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ project, organization, status, assigned_to_me, include_completed, limit }) => {
      const p = await findProject(db, project, organization);
      if ("error" in p) return fail(p.error);
      const opts = await options(db, p.organization_id);
      let q = db
        .from("tasks")
        .select("number, title, status_id, priority_id, assignee_id, due_date, updated_at")
        .eq("project_id", p.id)
        .order("number", { ascending: false })
        .limit(limit);
      if (status) {
        const s = pick(opts, "task_status", status);
        if ("error" in s) return fail(s.error);
        q = q.eq("status_id", s.id);
      } else if (!include_completed) {
        const done = opts.filter((o) => o.kind === "task_status" && o.category === "completed").map((o) => o.id);
        if (done.length) q = q.not("status_id", "in", `(${done.join(",")})`);
      }
      if (assigned_to_me) q = q.eq("assignee_id", me);
      const { data, error } = await q;
      if (error) return fail(error.message);
      const people = await namesOf(db, data.map((t) => t.assignee_id));
      return ok(
        data.map((t) => ({
          key: `${p.key}-${t.number}`,
          title: t.title,
          status: label(opts, t.status_id),
          priority: label(opts, t.priority_id),
          assignee: people(t.assignee_id),
          due_date: t.due_date,
          updated_at: t.updated_at,
        })),
      );
    },
  );

  server.registerTool(
    "get_task",
    {
      description: "Get one task with its description and comments.",
      inputSchema: z.object({ key, organization: org }),
      annotations: { readOnlyHint: true },
    },
    async ({ key, organization }) => {
      const t = await findTask(db, key, organization);
      if ("error" in t) return fail(t.error);
      const opts = await options(db, t.project.organization_id);
      const { data: comments, error } = await db
        .from("comments")
        .select("author_id, body, created_at")
        .eq("task_id", t.id)
        .order("created_at")
        .limit(100);
      if (error) return fail(error.message);
      const people = await namesOf(db, [t.assignee_id, t.reporter_id, ...comments.map((c) => c.author_id)]);
      return ok({
        key: t.key,
        url: `${SITE_URL}/${t.project.org_slug}/projects/${t.project.key.toLowerCase()}?task=${t.key.toLowerCase()}`,
        project: t.project.name,
        title: t.title,
        description: t.description,
        status: label(opts, t.status_id),
        priority: label(opts, t.priority_id),
        assignee: people(t.assignee_id),
        reporter: people(t.reporter_id),
        start_date: t.start_date,
        due_date: t.due_date,
        blocked_reason: t.blocked_reason,
        created_at: t.created_at,
        updated_at: t.updated_at,
        comments: comments.map((c) => ({ author: people(c.author_id), body: c.body, created_at: c.created_at })),
      });
    },
  );

  const fields = {
    description: z.string().max(20000).optional(),
    status: z.string().optional().describe("Status name, see list_projects"),
    priority: z.string().optional().describe("Priority name, see list_projects"),
    assignee: z.string().optional().describe('Email or full name of an organization member, "me", or "none"'),
    due_date: z.iso.date().nullable().optional().describe("YYYY-MM-DD, or null to clear"),
  };

  server.registerTool(
    "create_task",
    {
      description: "Create a task in a project. Returns its key. Status and priority default to the organization's defaults.",
      inputSchema: z.object({ project: z.string().describe("Project key, e.g. WEB"), organization: org, title: z.string().trim().min(1).max(200), ...fields }),
    },
    async ({ project, organization, title, description, status, priority, assignee, due_date }) => {
      const p = await findProject(db, project, organization);
      if ("error" in p) return fail(p.error);
      const opts = await options(db, p.organization_id);
      const s = pick(opts, "task_status", status);
      if ("error" in s) return fail(s.error);
      const pr = pick(opts, "task_priority", priority);
      if ("error" in pr) return fail(pr.error);
      const a = assignee ? await findMember(db, p.organization_id, assignee, me) : { id: null };
      if ("error" in a) return fail(a.error);
      const { data, error } = await db
        .from("tasks")
        .insert({
          organization_id: p.organization_id,
          project_id: p.id,
          title,
          description: description?.trim() ?? "",
          status_id: s.id,
          priority_id: pr.id,
          assignee_id: a.id,
          due_date: due_date ?? null,
          reporter_id: me,
          number: 0, // replaced by the assign_item_number trigger
        })
        .select("number")
        .single();
      if (error) return fail(noAccess(error, "create tasks in this project"));
      return ok({ key: `${p.key}-${data.number}`, created: true });
    },
  );

  server.registerTool(
    "update_task",
    {
      description: "Change a task's title, description, status, priority, assignee or due date. Only the fields given are changed.",
      inputSchema: z.object({ key, organization: org, title: z.string().trim().min(1).max(200).optional(), ...fields }),
      annotations: { idempotentHint: true },
    },
    async ({ key, organization, title, description, status, priority, assignee, due_date }) => {
      const t = await findTask(db, key, organization);
      if ("error" in t) return fail(t.error);
      const opts = await options(db, t.project.organization_id);
      const patch: Database["public"]["Tables"]["tasks"]["Update"] = {};
      if (title !== undefined) patch.title = title;
      if (description !== undefined) patch.description = description.trim();
      if (due_date !== undefined) patch.due_date = due_date;
      if (status) {
        const s = pick(opts, "task_status", status);
        if ("error" in s) return fail(s.error);
        patch.status_id = s.id;
      }
      if (priority) {
        const pr = pick(opts, "task_priority", priority);
        if ("error" in pr) return fail(pr.error);
        patch.priority_id = pr.id;
      }
      if (assignee) {
        const a = await findMember(db, t.project.organization_id, assignee, me);
        if ("error" in a) return fail(a.error);
        patch.assignee_id = a.id;
      }
      if (!Object.keys(patch).length) return fail("Nothing to change.");
      const { error } = await db.from("tasks").update(patch).eq("id", t.id).select("id").single();
      if (error) return fail(noAccess(error, "change this task"));
      return ok({ key: t.key, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "add_comment",
    {
      description: "Add a comment to a task as the signed-in user. The assignee is notified.",
      inputSchema: z.object({ key, organization: org, body: z.string().trim().min(1).max(10000) }),
    },
    async ({ key, organization, body }) => {
      const t = await findTask(db, key, organization);
      if ("error" in t) return fail(t.error);
      const { error } = await db.from("comments").insert({
        organization_id: t.project.organization_id,
        project_id: t.project.id,
        task_id: t.id,
        body,
        author_id: me,
      });
      if (error) return fail(noAccess(error, "comment on this task"));
      return ok({ key: t.key, commented: true });
    },
  );

  return server;
}

// --- Lookups -----------------------------------------------------------------

async function findOrgs(db: Db, slug?: string) {
  let q = db.from("organizations").select("id, slug").is("archived_at", null);
  if (slug) q = q.eq("slug", slug.toLowerCase());
  const { data, error } = await q;
  if (error) return { error: error.message };
  if (slug && !data.length) return { error: `No organization "${slug}". Use list_organizations.` };
  return data;
}

async function findProject(db: Db, key: string, slug?: string) {
  const orgs = await findOrgs(db, slug);
  if ("error" in orgs) return orgs;
  const { data, error } = await db
    .from("projects")
    .select("id, key, name, organization_id")
    .eq("key", key.toUpperCase())
    .in("organization_id", orgs.map((o) => o.id))
    .is("archived_at", null);
  if (error) return { error: error.message };
  if (!data.length) return { error: `No project with key ${key.toUpperCase()}. Use list_projects.` };
  if (data.length > 1) return { error: `Several organizations have a project ${key.toUpperCase()}. Pass organization (one of: ${data.map((p) => orgs.find((o) => o.id === p.organization_id)?.slug).join(", ")}).` };
  return { ...data[0], org_slug: orgs.find((o) => o.id === data[0].organization_id)!.slug };
}

async function findTask(db: Db, key: string, slug?: string) {
  const dash = key.lastIndexOf("-");
  const project = await findProject(db, key.slice(0, dash), slug);
  if ("error" in project) return project;
  const { data, error } = await db
    .from("tasks")
    .select("id, number, title, description, status_id, priority_id, assignee_id, reporter_id, start_date, due_date, blocked_reason, created_at, updated_at")
    .eq("project_id", project.id)
    .eq("number", Number(key.slice(dash + 1)))
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: `No task ${key.toUpperCase()}.` };
  return { ...data, key: `${project.key}-${data.number}`, project };
}

async function options(db: Db, orgId: string): Promise<Option[]> {
  const { data } = await db
    .from("options")
    .select("id, kind, name, category, is_default")
    .eq("organization_id", orgId)
    .in("kind", ["task_status", "task_priority"])
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

/** The option of this kind with the given name, or the organization's default when no name is given. */
function pick(opts: Option[], kind: string, name?: string): Option | { error: string } {
  const ofKind = opts.filter((o) => o.kind === kind);
  const found = name ? ofKind.find((o) => o.name.toLowerCase() === name.trim().toLowerCase()) : ofKind.find((o) => o.is_default) ?? ofKind[0];
  const what = kind === "task_status" ? "status" : "priority";
  return found ?? { error: `Unknown ${what} "${name}". Use one of: ${names(opts, kind).join(", ")}.` };
}

function names(opts: Option[], kind: string) {
  return opts.filter((o) => o.kind === kind).map((o) => o.name);
}

function label(opts: Option[], id: string | null) {
  return opts.find((o) => o.id === id)?.name ?? null;
}

async function findMember(db: Db, orgId: string, who: string, me: string): Promise<{ id: string | null } | { error: string }> {
  const w = who.trim().toLowerCase();
  if (w === "none") return { id: null };
  if (w === "me") return { id: me };
  const { data: members, error } = await db.from("organization_members").select("user_id").eq("organization_id", orgId).eq("status", "active");
  if (error) return { error: error.message };
  const { data: people } = await db.from("profiles").select("id, email, full_name").in("id", members.map((m) => m.user_id));
  const matches = (people ?? []).filter((p) => p.email.toLowerCase() === w || p.full_name.toLowerCase() === w);
  if (matches.length === 1) return { id: matches[0].id };
  return { error: matches.length ? `Several members are called "${who}". Use their email.` : `No active member "${who}" in this organization.` };
}

/** Looks up display names ("Full Name <email>") for the given user ids. */
async function namesOf(db: Db, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (unique.length) {
    const { data } = await db.from("profiles").select("id, email, full_name").in("id", unique);
    for (const p of data ?? []) map.set(p.id, p.full_name ? `${p.full_name} <${p.email}>` : p.email);
  }
  return (id: string | null) => (id && map.get(id)) || null;
}

// --- Results -----------------------------------------------------------------

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** RLS rejects inserts with 42501 and filters updates down to no rows (PGRST116); say what that means. */
function noAccess(error: { code?: string; message: string }, what: string) {
  return error.code === "42501" || error.code === "PGRST116" ? `Your role doesn't allow you to ${what}.` : error.message;
}
