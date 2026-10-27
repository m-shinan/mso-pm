// The MCP endpoint, called with real users' access tokens as an MCP client would.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleMcp } from "@/features/mcp/server";
import { admin, cleanup, makeUser, ok, ran, RUN, type TestUser } from "./helpers";

let owner: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let orgId = "";
const slug = `mcp-${RUN}`;

async function rpc(user: TestUser | null, method: string, params: Record<string, unknown> = {}) {
  const token = user ? (await user.client.auth.getSession()).data.session!.access_token : null;
  return handleMcp(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
}

/** Calls a tool and returns its parsed result (or the error text, with isError). */
async function call(user: TestUser, name: string, args: Record<string, unknown> = {}) {
  const res = await rpc(user, "tools/call", { name, arguments: args });
  expect(res.status).toBe(200);
  const text = await res.text();
  const json = JSON.parse(text.startsWith("{") ? text : text.split("\n").find((l) => l.startsWith("data:"))!.slice(5));
  const result = json.result as { content: { text: string }[]; isError?: boolean };
  const body = result.content[0].text;
  return result.isError ? { error: body } : JSON.parse(body);
}

beforeAll(async () => {
  [owner, viewer, outsider] = await Promise.all(["mcpowner", "mcpviewer", "mcpoutsider"].map(makeUser));
  orgId = ok(await owner.client.rpc("create_organization", { p_name: `MCP ${RUN}`, p_slug: slug }), "create org").id;
  const roleId = ok(await admin.from("roles").select("id").eq("organization_id", orgId).eq("key", "viewer").single(), "role").id;
  ran(await admin.from("organization_members").insert({ organization_id: orgId, user_id: viewer.id, role_id: roleId }), "add viewer");
  const opts = ok(await admin.from("options").select("id, kind, name").eq("organization_id", orgId), "options");
  const id = (kind: string, name: string) => opts.find((o) => o.kind === kind && o.name === name)!.id;
  const projectId = ok(
    await owner.client
      .from("projects")
      .insert({
        organization_id: orgId, key: "MCP", name: "MCP project", created_by: owner.id,
        type_id: id("project_type", "Web app"), status_id: id("project_status", "In progress"), priority_id: id("task_priority", "Medium"),
      })
      .select("id")
      .single(),
    "create project",
  ).id;
  // Viewers only see projects they belong to.
  ran(await owner.client.from("project_members").insert({ project_id: projectId, organization_id: orgId, user_id: viewer.id }), "project member");
}, 60_000);

afterAll(async () => {
  await cleanup([orgId].filter(Boolean));
}, 60_000);

describe("mcp endpoint", () => {
  it("asks unauthenticated clients to sign in, pointing at the metadata", async () => {
    const res = await rpc(null, "tools/list");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('resource_metadata="http://localhost:3000/api/mcp/oauth-protected-resource"');
  });

  it("serves protected resource metadata naming Supabase Auth", async () => {
    const res = await handleMcp(new Request("http://localhost:3000/api/mcp/oauth-protected-resource"));
    expect(res.status).toBe(200);
    const meta = await res.json();
    expect(meta.resource).toBe("http://localhost:3000/api/mcp");
    expect(meta.authorization_servers).toEqual([`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`]);
  });

  it("rejects a forged token", async () => {
    const res = await handleMcp(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: "Bearer not.a.jwt" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("lists organizations and projects for the signed-in user only", async () => {
    expect(await call(owner, "list_organizations")).toEqual([{ slug, name: `MCP ${RUN}` }]);
    const projects = await call(owner, "list_projects");
    expect(projects[0].projects.map((p: { key: string }) => p.key)).toEqual(["MCP"]);
    expect(projects[0].task_statuses).toContain("Todo");
    expect(await call(outsider, "list_organizations")).toEqual([]);
    expect((await call(outsider, "list_tasks", { project: "MCP" })).error).toMatch(/No project/);
  });

  it("creates, updates, comments on and reads a task", async () => {
    const created = await call(owner, "create_task", { project: "mcp", title: "From Claude", assignee: "me", due_date: "2026-12-01" });
    expect(created.key).toMatch(/^MCP-\d+$/);

    const updated = await call(owner, "update_task", { key: created.key, status: "in progress", priority: "High" });
    expect(updated.updated.sort()).toEqual(["priority_id", "status_id"]);
    expect((await call(owner, "update_task", { key: created.key, status: "Nope" })).error).toMatch(/Unknown status "Nope"\. Use one of: .*Todo/);

    expect(await call(owner, "add_comment", { key: created.key, body: "Looks good" })).toEqual({ key: created.key, commented: true });

    const task = await call(owner, "get_task", { key: created.key.toLowerCase() });
    expect(task).toMatchObject({ key: created.key, title: "From Claude", status: "In progress", priority: "High", due_date: "2026-12-01" });
    expect(task.assignee).toContain(owner.email);
    expect(task.comments).toEqual([expect.objectContaining({ body: "Looks good" })]);
    expect(task.url).toContain(`/${slug}/projects/mcp?task=${created.key.toLowerCase()}`);

    const list = await call(owner, "list_tasks", { project: "MCP", assigned_to_me: true });
    expect(list.map((t: { key: string }) => t.key)).toContain(created.key);
  });

  it("keeps the user's role: viewers can read but not write", async () => {
    const list = await call(viewer, "list_tasks", { project: "MCP" });
    expect(list.length).toBeGreaterThan(0);
    expect((await call(viewer, "create_task", { project: "MCP", title: "nope" })).error).toBe("Your role doesn't allow you to create tasks in this project.");
    expect((await call(viewer, "update_task", { key: list[0].key, title: "nope" })).error).toBe("Your role doesn't allow you to change this task.");
    expect((await call(viewer, "add_comment", { key: list[0].key, body: "nope" })).error).toBe("Your role doesn't allow you to comment on this task.");
  });
});
