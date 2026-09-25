// Tenant isolation and role permissions, enforced by the database.
// Every assertion runs through the public API as a real signed-in user.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions";
import { admin, anon, cleanup, makeUser, ok, ran, RUN, sha256, token, type TestUser } from "./helpers";

let owner: TestUser; // owner of org A
let ownerB: TestUser; // owner of org B
let both: TestUser; // developer in A, admin in B
let pm: TestUser; // project manager in A
let dev: TestUser; // developer in A, member of project P1 only
let viewer: TestUser; // viewer in A, member of P1
let outsider: TestUser; // no memberships
let invitee: TestUser; // receives an invitation during the tests

const org = { A: "", B: "" };
const project = { P1: "", P2: "", B1: "" };
const opt: Record<string, Record<string, string>> = { A: {}, B: {} };

async function optionIds(orgId: string) {
  const rows = ok(await admin.from("options").select("id, kind, name").eq("organization_id", orgId), "options");
  const map: Record<string, string> = {};
  for (const r of rows) map[`${r.kind}:${r.name}`] = r.id;
  return map;
}

async function roleId(orgId: string, key: string) {
  return ok(await admin.from("roles").select("id").eq("organization_id", orgId).eq("key", key).single(), "role").id;
}

async function addMember(orgId: string, user: TestUser, role: string) {
  ran(await admin.from("organization_members").insert({ organization_id: orgId, user_id: user.id, role_id: await roleId(orgId, role) }), "add member");
}

async function newProject(client: TestUser, orgKey: "A" | "B", key: string, name: string) {
  const o = opt[orgKey];
  return ok(
    await client.client
      .from("projects")
      .insert({
        organization_id: org[orgKey], key, name, created_by: client.id,
        type_id: o["project_type:Web app"], status_id: o["project_status:In progress"], priority_id: o["task_priority:Medium"],
      })
      .select("id")
      .single(),
    `create project ${key}`,
  ).id;
}

async function newTask(user: TestUser, orgKey: "A" | "B", projectId: string, title: string, extra: Record<string, unknown> = {}) {
  const o = opt[orgKey];
  return user.client
    .from("tasks")
    .insert({
      organization_id: org[orgKey], project_id: projectId, title, reporter_id: user.id,
      status_id: o["task_status:Todo"], priority_id: o["task_priority:Medium"], number: 0, ...extra,
    })
    .select("id, number, status_id")
    .single();
}

beforeAll(async () => {
  [owner, ownerB, both, pm, dev, viewer, outsider, invitee] = await Promise.all(
    ["owner", "ownerb", "both", "pm", "dev", "viewer", "outsider", "invitee"].map(makeUser),
  );

  org.A = ok(await owner.client.rpc("create_organization", { p_name: `A ${RUN}`, p_slug: `a-${RUN}` }), "create A").id;
  org.B = ok(await ownerB.client.rpc("create_organization", { p_name: `B ${RUN}`, p_slug: `b-${RUN}` }), "create B").id;
  opt.A = await optionIds(org.A);
  opt.B = await optionIds(org.B);

  await addMember(org.A, both, "developer");
  await addMember(org.B, both, "admin");
  await addMember(org.A, pm, "project_manager");
  await addMember(org.A, dev, "developer");
  await addMember(org.A, viewer, "viewer");

  project.P1 = await newProject(owner, "A", "PONE", "Project One");
  project.P2 = await newProject(owner, "A", "PTWO", "Project Two");
  project.B1 = await newProject(ownerB, "B", "BONE", "B Project");

  ran(await owner.client.from("project_members").insert([
    { project_id: project.P1, organization_id: org.A, user_id: dev.id },
    { project_id: project.P1, organization_id: org.A, user_id: viewer.id },
    { project_id: project.P1, organization_id: org.A, user_id: both.id },
  ]), "project members");
}, 60_000);

afterAll(async () => {
  await cleanup([org.A, org.B].filter(Boolean));
}, 60_000);

describe("organization creation", () => {
  it("makes the creator owner and seeds default options", async () => {
    const perms = ok(await owner.client.rpc("my_permissions", { p_org: org.A }), "perms") as string[];
    expect(perms).toContain("settings.manage");
    expect(Object.keys(opt.A)).toContain("task_status:Backlog");
    expect(Object.keys(opt.A)).toContain("issue_severity:Critical");
    expect(Object.keys(opt.A)).toContain("project_type:Digital menu");
  });

  it("seeds the same permission keys the app knows about", async () => {
    const perms = ok(await owner.client.rpc("my_permissions", { p_org: org.A }), "perms") as string[];
    expect([...perms].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("refuses anonymous callers", async () => {
    const res = await anon().rpc("create_organization", { p_name: "x", p_slug: `x-${RUN}` });
    expect(res.error).not.toBeNull();
  });
});

describe("tenant isolation", () => {
  it("an owner of A cannot see B", async () => {
    const orgs = ok(await owner.client.from("organizations").select("id"), "orgs");
    expect(orgs.map((o) => o.id)).toEqual([org.A]);
    expect(ok(await owner.client.from("projects").select("id").eq("id", project.B1), "p")).toHaveLength(0);
    expect(ok(await owner.client.from("options").select("id").eq("organization_id", org.B), "o")).toHaveLength(0);
    expect(ok(await owner.client.from("roles").select("id").eq("organization_id", org.B), "r")).toHaveLength(0);
  });

  it("forged IDs do not write into another organization", async () => {
    const res = await newTask(owner, "B", project.B1, "sneaky");
    expect(res.error).not.toBeNull();
    const upd = ok(await owner.client.from("projects").update({ name: "hacked" }).eq("id", project.B1).select("id"), "upd");
    expect(upd).toHaveLength(0);
    const b1 = ok(await admin.from("projects").select("name").eq("id", project.B1).single(), "b1");
    expect(b1.name).toBe("B Project");
  });

  it("a row cannot reference another organization's options", async () => {
    // Own project, but a status id from org B.
    const res = await newTask(owner, "A", project.P1, "bad status", { status_id: opt.B["task_status:Todo"] });
    expect(res.error).not.toBeNull();
  });

  it("a user in both organizations sees both, each with its own role", async () => {
    const orgs = ok(await both.client.from("organizations").select("id"), "orgs").map((o) => o.id).sort();
    expect(orgs).toEqual([org.A, org.B].sort());
    const permsA = ok(await both.client.rpc("my_permissions", { p_org: org.A }), "a") as string[];
    const permsB = ok(await both.client.rpc("my_permissions", { p_org: org.B }), "b") as string[];
    expect(permsA).not.toContain("members.manage");
    expect(permsB).toContain("members.manage");
  });

  it("project membership in A grants nothing in B", async () => {
    expect(ok(await dev.client.from("projects").select("id").eq("organization_id", org.B), "p")).toHaveLength(0);
  });

  it("an outsider sees nothing", async () => {
    for (const table of ["organizations", "projects", "tasks", "options", "organization_members", "activity"]) {
      expect(ok(await outsider.client.from(table).select("*").limit(5), table)).toHaveLength(0);
    }
  });

  it("the anonymous role has no table access at all", async () => {
    const res = await anon().from("projects").select("id").limit(1);
    expect(res.error?.message ?? "").toMatch(/permission denied/i);
  });

  it("the dashboard only counts the caller's organization", async () => {
    const sum = ok(await owner.client.rpc("dashboard_summary", { p_org: org.B }), "sum") as { projects: unknown[] };
    expect(sum.projects).toHaveLength(0);
  });
});

describe("roles", () => {
  let taskId = "";

  it("owner creates tasks with sequential numbers", async () => {
    const t1 = ok(await newTask(owner, "A", project.P1, "first"), "t1");
    const t2 = ok(await newTask(owner, "A", project.P1, "second"), "t2");
    expect(t2.number).toBe(t1.number + 1);
    taskId = t1.id;
  });

  it("developer sees only projects they belong to", async () => {
    const ids = ok(await dev.client.from("projects").select("id"), "p").map((p) => p.id);
    expect(ids).toEqual([project.P1]);
  });

  it("developer can create and update tasks but not delete them", async () => {
    ok(await newTask(dev, "A", project.P1, "dev task"), "dev create");
    const upd = ok(await dev.client.from("tasks").update({ status_id: opt.A["task_status:Review"] }).eq("id", taskId).select("id"), "upd");
    expect(upd).toHaveLength(1);
    const del = ok(await dev.client.from("tasks").delete().eq("id", taskId).select("id"), "del");
    expect(del).toHaveLength(0);
  });

  it("developer cannot create tasks in a project they don't belong to", async () => {
    const res = await newTask(dev, "A", project.P2, "not mine");
    expect(res.error).not.toBeNull();
  });

  it("developer cannot create projects", async () => {
    const res = await dev.client.from("projects").insert({
      organization_id: org.A, key: "DEVX", name: "x", created_by: dev.id,
      type_id: opt.A["project_type:Web app"], status_id: opt.A["project_status:Planning"], priority_id: opt.A["task_priority:Low"],
    });
    expect(res.error).not.toBeNull();
  });

  it("viewer reads but cannot write", async () => {
    expect(ok(await viewer.client.from("tasks").select("id").eq("project_id", project.P1), "read").length).toBeGreaterThan(0);
    expect((await newTask(viewer, "A", project.P1, "viewer")).error).not.toBeNull();
    const upd = ok(await viewer.client.from("tasks").update({ title: "viewer edit" }).eq("id", taskId).select("id"), "upd");
    expect(upd).toHaveLength(0);
    const comment = await viewer.client.from("comments").insert({
      organization_id: org.A, project_id: project.P1, task_id: taskId, author_id: viewer.id, body: "hi",
    });
    expect(comment.error).not.toBeNull();
  });

  it("project manager sees every project and can delete tasks", async () => {
    const ids = ok(await pm.client.from("projects").select("id").eq("organization_id", org.A), "p").map((p) => p.id);
    expect(ids.sort()).toEqual([project.P1, project.P2].sort());
    const t = ok(await newTask(pm, "A", project.P2, "pm task"), "pm create");
    const del = ok(await pm.client.from("tasks").delete().eq("id", t.id).select("id"), "del");
    expect(del).toHaveLength(1);
  });

  it("a project-level role overrides the organization role", async () => {
    // Make the viewer a developer on P1 only.
    ran(await owner.client.from("project_members").update({ role_id: await roleId(org.A, "developer") })
      .eq("project_id", project.P1).eq("user_id", viewer.id), "override");
    ok(await newTask(viewer, "A", project.P1, "now allowed"), "viewer create after override");
  });

  it("only settings.manage changes options, and options in use cannot be deleted", async () => {
    const devUpd = ok(await dev.client.from("options").update({ name: "Nope" }).eq("id", opt.A["task_status:Review"]).select("id"), "dev");
    expect(devUpd).toHaveLength(0);
    const del = await owner.client.from("options").delete().eq("id", opt.A["task_status:Todo"]);
    expect(del.error).not.toBeNull();
    const rename = ok(await owner.client.from("options").update({ name: "Code review" }).eq("id", opt.A["task_status:Review"]).select("name"), "rename");
    expect(rename[0].name).toBe("Code review");
  });
});

describe("owners", () => {
  it("an admin cannot demote the owner", async () => {
    // "both" is admin in B.
    const res = await both.client.from("organization_members").update({ role_id: await roleId(org.B, "viewer") })
      .eq("organization_id", org.B).eq("user_id", ownerB.id);
    expect(res.error).not.toBeNull();
  });

  it("the last owner cannot leave", async () => {
    const res = await ownerB.client.from("organization_members").delete().eq("organization_id", org.B).eq("user_id", ownerB.id);
    expect(res.error).not.toBeNull();
  });
});

describe("invitations", () => {
  it("only the invited email can accept, once", async () => {
    const t = token();
    ran(await owner.client.from("invitations").insert({
      organization_id: org.A, email: invitee.email, role_id: await roleId(org.A, "developer"), token_hash: sha256(t), invited_by: owner.id,
    }), "invite");

    const wrong = await outsider.client.rpc("accept_invitation", { p_token: t });
    expect(wrong.error).not.toBeNull();

    const slug = ok(await invitee.client.rpc("accept_invitation", { p_token: t }), "accept");
    expect(slug).toBe(`a-${RUN}`);
    expect(ok(await invitee.client.from("organizations").select("id"), "orgs").map((o) => o.id)).toEqual([org.A]);

    const again = await invitee.client.rpc("accept_invitation", { p_token: t });
    expect(again.error).not.toBeNull();
  });

  it("revoked and expired invitations do not work", async () => {
    const t1 = token();
    const inv = ok(await owner.client.from("invitations").insert({
      organization_id: org.A, email: outsider.email, role_id: await roleId(org.A, "viewer"), token_hash: sha256(t1), invited_by: owner.id,
    }).select("id").single(), "invite");
    ran(await owner.client.from("invitations").update({ status: "revoked" }).eq("id", inv.id), "revoke");
    expect((await outsider.client.rpc("accept_invitation", { p_token: t1 })).error).not.toBeNull();

    const t2 = token();
    ran(await admin.from("invitations").insert({
      organization_id: org.A, email: outsider.email, role_id: await roleId(org.A, "viewer"), token_hash: sha256(t2),
      invited_by: owner.id, expires_at: new Date(Date.now() - 1000).toISOString(),
    }), "expired invite");
    expect((await outsider.client.rpc("accept_invitation", { p_token: t2 })).error).not.toBeNull();
    expect(ok(await outsider.client.from("organizations").select("id"), "orgs")).toHaveLength(0);
  });

  it("nobody can invite someone straight into the owner role, and developers cannot invite", async () => {
    const asOwner = await owner.client.from("invitations").insert({
      organization_id: org.A, email: `x-${RUN}@example.com`, role_id: await roleId(org.A, "owner"), token_hash: sha256(token()), invited_by: owner.id,
    });
    expect(asOwner.error).not.toBeNull();
    const asDev = await dev.client.from("invitations").insert({
      organization_id: org.A, email: `y-${RUN}@example.com`, role_id: await roleId(org.A, "viewer"), token_hash: sha256(token()), invited_by: dev.id,
    });
    expect(asDev.error).not.toBeNull();
  });
});

describe("activity and notifications", () => {
  it("records status changes and notifies the new assignee", async () => {
    const t = ok(await newTask(owner, "A", project.P1, "assign me"), "task");
    ran(await owner.client.from("tasks").update({ assignee_id: dev.id, status_id: opt.A["task_status:In progress"] }).eq("id", t.id), "update");
    const act = ok(await owner.client.from("activity").select("action, changes").eq("entity_id", t.id).order("id"), "activity");
    expect(act.map((a) => a.action)).toEqual(["created", "updated"]);
    expect((act[1].changes as Record<string, unknown>).status).toEqual(["Todo", "In progress"]);
    const notes = ok(await dev.client.from("notifications").select("kind, entity_id").eq("entity_id", t.id), "notes");
    expect(notes).toEqual([{ kind: "task_assigned", entity_id: t.id }]);
    // Owner does not see the developer's notifications.
    expect(ok(await owner.client.from("notifications").select("id").eq("entity_id", t.id), "own")).toHaveLength(0);
  });

  it("clients cannot write activity directly", async () => {
    const res = await owner.client.from("activity").insert({
      organization_id: org.A, action: "forged", entity_type: "task", entity_label: "x",
    });
    expect(res.error).not.toBeNull();
  });
});
