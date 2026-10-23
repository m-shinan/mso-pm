// Tenant isolation and role permissions, enforced by the database.
// Every assertion runs through the public API as a real signed-in user.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
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

describe("attachments storage", () => {
  const uploaded: string[] = [];
  afterAll(async () => {
    if (uploaded.length) await admin.storage.from("attachments").remove(uploaded);
  });
  const file = () => new Blob(["hello"], { type: "text/plain" });

  it("a project member uploads and reads; outsiders and other orgs cannot", async () => {
    const t = ok(await newTask(owner, "A", project.P1, "has file"), "task");
    const path = `${org.A}/${project.P1}/task/${t.id}/${RUN}-note.txt`;
    ran(await dev.client.storage.from("attachments").upload(path, file()), "dev upload");
    uploaded.push(path);
    ran(await dev.client.from("attachments").insert({
      organization_id: org.A, project_id: project.P1, task_id: t.id, storage_path: path, name: "note.txt", size_bytes: 5, mime_type: "text/plain", uploaded_by: dev.id,
    }), "metadata");

    expect((await dev.client.storage.from("attachments").createSignedUrl(path, 60)).error).toBeNull();
    expect((await viewer.client.storage.from("attachments").createSignedUrl(path, 60)).error).toBeNull(); // viewer is on P1
    expect((await outsider.client.storage.from("attachments").createSignedUrl(path, 60)).error).not.toBeNull();
    expect((await ownerB.client.storage.from("attachments").createSignedUrl(path, 60)).error).not.toBeNull();
  });

  it("uploads into another org's folder, or a mismatched org/project path, are refused", async () => {
    const intoB = await owner.client.storage.from("attachments").upload(`${org.B}/${project.B1}/task/x/${RUN}.txt`, file());
    expect(intoB.error).not.toBeNull();
    const mismatched = await ownerB.client.storage.from("attachments").upload(`${org.B}/${project.P1}/task/x/${RUN}.txt`, file());
    expect(mismatched.error).not.toBeNull();
    const devOnP2 = await dev.client.storage.from("attachments").upload(`${org.A}/${project.P2}/task/x/${RUN}.txt`, file());
    expect(devOnP2.error).not.toBeNull();
  });

  it("metadata can't point outside its own org/project folder", async () => {
    const t = ok(await newTask(owner, "A", project.P1, "bad path"), "task");
    const res = await owner.client.from("attachments").insert({
      organization_id: org.A, project_id: project.P1, task_id: t.id, storage_path: `${org.B}/${project.B1}/x.txt`, name: "x", size_bytes: 1, mime_type: "text/plain", uploaded_by: owner.id,
    });
    expect(res.error).not.toBeNull();
  });
});

describe("dependencies, project roles, custom roles", () => {
  it("rejects dependency loops", async () => {
    const a = ok(await newTask(owner, "A", project.P1, "dep A"), "a");
    const b = ok(await newTask(owner, "A", project.P1, "dep B"), "b");
    const c = ok(await newTask(owner, "A", project.P1, "dep C"), "c");
    const dep = (task: string, by: string) =>
      owner.client.from("task_dependencies").insert({ task_id: task, blocked_by_id: by, project_id: project.P1, organization_id: org.A });
    ran(await dep(a.id, b.id), "a<-b");
    ran(await dep(b.id, c.id), "b<-c");
    expect((await dep(c.id, a.id)).error).not.toBeNull();
  });

  it("a project manager can't give anyone a project role stronger than their own", async () => {
    ran(await admin.from("project_members").insert({ project_id: project.P2, organization_id: org.A, user_id: dev.id }), "dev on P2");
    const toAdmin = await pm.client.from("project_members").update({ role_id: await roleId(org.A, "admin") })
      .eq("project_id", project.P2).eq("user_id", dev.id);
    expect(toAdmin.error).not.toBeNull();
    const toDeveloper = await pm.client.from("project_members").update({ role_id: await roleId(org.A, "developer") })
      .eq("project_id", project.P2).eq("user_id", dev.id);
    expect(toDeveloper.error).toBeNull();
    const toOwner = await owner.client.from("project_members").update({ role_id: await roleId(org.A, "owner") })
      .eq("project_id", project.P2).eq("user_id", dev.id);
    expect(toOwner.error).not.toBeNull();
  });

  it("owners create custom roles; in-use roles can't be deleted; system roles can't be deleted", async () => {
    const role = ok(await owner.client.from("roles").insert({
      organization_id: org.A, key: "qa_tester", name: "QA tester", permissions: ["issues.create", "issues.update"],
    }).select("id").single(), "custom role");
    ran(await owner.client.from("organization_members").update({ role_id: role.id }).eq("organization_id", org.A).eq("user_id", viewer.id), "assign");
    const perms = ok(await viewer.client.rpc("my_permissions", { p_org: org.A }), "perms") as string[];
    expect(perms.sort()).toEqual(["issues.create", "issues.update"]);
    expect((await owner.client.from("roles").delete().eq("id", role.id)).error).not.toBeNull(); // in use
    const sys = ok(await owner.client.from("roles").delete().eq("id", await roleId(org.A, "viewer")).select("id"), "sys");
    expect(sys).toHaveLength(0);
    expect((await dev.client.from("roles").insert({ organization_id: org.A, key: "sneaky", name: "x", permissions: [] })).error).not.toBeNull();
  });
});

describe("live updates and email preference", () => {
  function listen(user: TestUser, projectId: string) {
    const got: string[] = [];
    const channel = user.client.channel(`test-${user.id}-${projectId}`);
    const ready = new Promise<void>((resolve, reject) => {
      channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, (p) =>
          got.push((p.new as { title: string }).title),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`realtime: ${status}`));
        });
    });
    return { got, ready, stop: () => user.client.removeChannel(channel) };
  }

  it("project members receive task changes live; people outside the organization receive nothing", async () => {
    const member = listen(dev, project.P1);
    const stranger = listen(ownerB, project.P1);
    await Promise.all([member.ready, stranger.ready]);
    // The server attaches the change listener just after acknowledging the subscription.
    await new Promise((r) => setTimeout(r, 1000));
    const title = `live ${RUN}`;
    ran(await newTask(owner, "A", project.P1, title), "task");
    await expect.poll(() => member.got, { timeout: 10_000 }).toContain(title);
    await new Promise((r) => setTimeout(r, 2000));
    expect(stranger.got).toEqual([]);
    await Promise.all([member.stop(), stranger.stop()]);
  }, 30_000);

  it("people can switch their own email notifications off, and no one else's", async () => {
    ran(await dev.client.from("profiles").update({ email_notifications: false }).eq("id", dev.id), "own");
    expect(ok(await admin.from("profiles").select("email_notifications").eq("id", dev.id).single(), "read").email_notifications).toBe(false);
    ran(await dev.client.from("profiles").update({ email_notifications: false }).eq("id", pm.id), "other");
    expect(ok(await admin.from("profiles").select("email_notifications").eq("id", pm.id).single(), "read").email_notifications).toBe(true);
  });
});

describe("security review fixes", () => {
  it("inviters can only grant roles within their own permissions", async () => {
    const asAdmin = await pm.client.from("invitations").insert({
      organization_id: org.A, email: `pm-admin-${RUN}@example.com`, role_id: await roleId(org.A, "admin"), token_hash: sha256(token()), invited_by: pm.id,
    });
    expect(asAdmin.error).not.toBeNull();
    ran(await pm.client.from("invitations").insert({
      organization_id: org.A, email: `pm-dev-${RUN}@example.com`, role_id: await roleId(org.A, "developer"), token_hash: sha256(token()), invited_by: pm.id,
    }), "pm invites a developer");
  });

  it("an invitation cannot undo a deactivation", async () => {
    ran(await admin.from("organization_members").insert({
      organization_id: org.B, user_id: outsider.id, role_id: await roleId(org.B, "developer"), status: "deactivated",
    }), "deactivated member");
    const t = token();
    ran(await ownerB.client.from("invitations").insert({
      organization_id: org.B, email: outsider.email, role_id: await roleId(org.B, "developer"), token_hash: sha256(t), invited_by: ownerB.id,
    }), "invite");
    expect((await outsider.client.rpc("accept_invitation", { p_token: t })).error).not.toBeNull();
    const row = ok(await admin.from("organization_members").select("status").eq("organization_id", org.B).eq("user_id", outsider.id).single(), "row");
    expect(row.status).toBe("deactivated");
    ran(await admin.from("organization_members").delete().eq("organization_id", org.B).eq("user_id", outsider.id), "cleanup");
  });

  it("a comment can be edited but not moved to another organization", async () => {
    const task = ok(await newTask(both, "A", project.P1, "commented"), "task");
    const comment = ok(await both.client.from("comments").insert({
      organization_id: org.A, project_id: project.P1, task_id: task.id, author_id: both.id, body: "hello",
    }).select("id").single(), "comment");
    const bTask = ok(await newTask(ownerB, "B", project.B1, "target"), "b task");
    const moved = await both.client.from("comments").update({ organization_id: org.B, project_id: project.B1, task_id: bTask.id }).eq("id", comment.id);
    expect(moved.error).not.toBeNull();
    ran(await both.client.from("comments").update({ body: "edited", edited_at: new Date().toISOString() }).eq("id", comment.id), "edit");
  });

  it("a project membership cannot be handed to a different user", async () => {
    const res = await pm.client.from("project_members").update({ user_id: pm.id }).eq("project_id", project.P1).eq("user_id", both.id);
    expect(res.error).not.toBeNull();
  });

  it("a project cannot move to another organization", async () => {
    const res = await owner.client.from("projects").update({ organization_id: org.B }).eq("id", project.P2);
    expect(res.error).not.toBeNull();
  });
});

describe("feedback, account deletion and reserved slugs", () => {
  const feedback = (user: TestUser, subject: string) =>
    user.client.from("feedback").insert({ kind: "feature", subject, body: "A test message from the suite.", organization_id: org.A });

  afterAll(async () => {
    await admin.from("feedback").delete().in("user_id", [dev.id, viewer.id]);
  });

  it("anyone can send feedback, but only platform admins can read it", async () => {
    ran(await feedback(dev, "Export to CSV"), "send");
    expect(ok(await dev.client.from("feedback").select("id"), "read back")).toHaveLength(0);
    expect(ok(await owner.client.from("feedback").select("id"), "owner reads")).toHaveLength(0);
    expect(ok(await dev.client.rpc("is_platform_admin"), "admin?")).toBe(false);
    const row = ok(await admin.from("feedback").select("user_id, user_email, organization_name").eq("user_id", dev.id).limit(1).single(), "row");
    expect(row.user_email).toBe(dev.email);
    expect(row.organization_name).toBe(`A ${RUN}`);
  });

  it("feedback can't be sent as someone else or into another organization", async () => {
    const spoof = await dev.client.from("feedback").insert({ kind: "issue", subject: "x", body: "spoofed sender test", user_id: owner.id });
    expect(spoof.error).not.toBeNull();
    const otherOrg = await dev.client.from("feedback").insert({ kind: "issue", subject: "x", body: "wrong organization", organization_id: org.B });
    expect(otherOrg.error).not.toBeNull();
  });

  it("a sixth message within an hour is refused", async () => {
    for (let i = 1; i <= 5; i++) ran(await feedback(viewer, `Idea ${i}`), `send ${i}`);
    const sixth = await feedback(viewer, "Idea 6");
    expect(sixth.error?.code).toBe("54000");
  });

  it("organization URLs can't take a route the app uses", async () => {
    const res = await outsider.client.rpc("create_organization", { p_name: "Clash", p_slug: "feedback" });
    expect(res.error).not.toBeNull();
  });

  it("the only owner of an organization can't delete their account", async () => {
    const res = await owner.client.rpc("delete_my_account");
    expect(res.error?.message).toMatch(/only owner/);
    expect((await admin.auth.admin.getUserById(owner.id)).data.user).not.toBeNull();
  });

  it("anyone else can delete their own account, and it is gone", async () => {
    const leaving = await makeUser("leaving");
    ran(await leaving.client.rpc("delete_my_account"), "delete");
    expect((await admin.auth.admin.getUserById(leaving.id)).data.user).toBeNull();
  });
});

describe("chat", () => {
  const channel = async (user: TestUser, kind: string, projectId?: string) => {
    let q = user.client.from("chat_channels").select("id").eq("organization_id", org.A).eq("kind", kind);
    if (projectId) q = q.eq("project_id", projectId);
    return ok(await q, `${kind} channel`);
  };

  it("every member sees the organization's General channel; outsiders see nothing", async () => {
    expect(await channel(dev, "general")).toHaveLength(1);
    expect(ok(await outsider.client.from("chat_channels").select("id"), "outsider")).toHaveLength(0);
    expect(ok(await ownerB.client.from("chat_channels").select("id").eq("organization_id", org.A), "other org")).toHaveLength(0);
  });

  it("project channels follow who can read the project", async () => {
    expect(await channel(dev, "project", project.P1)).toHaveLength(1);
    expect(await channel(viewer, "project", project.P2)).toHaveLength(0);
    expect(await channel(pm, "project", project.P2)).toHaveLength(1);
  });

  it("messages reach channel members only, and can't be sent as someone else or into another organization", async () => {
    const [general] = await channel(dev, "general");
    ran(await dev.client.from("chat_messages").insert({ organization_id: org.A, channel_id: general.id, body: "Morning all" }), "post");
    expect(ok(await viewer.client.from("chat_messages").select("body").eq("channel_id", general.id), "read")).toEqual([{ body: "Morning all" }]);
    expect(ok(await outsider.client.from("chat_messages").select("id"), "outsider read")).toHaveLength(0);
    const intrude = await ownerB.client.from("chat_messages").insert({ organization_id: org.A, channel_id: general.id, body: "hi" });
    expect(intrude.error).not.toBeNull();
    const spoof = await dev.client.from("chat_messages").insert({ organization_id: org.A, channel_id: general.id, body: "x", author_id: owner.id });
    expect(spoof.error).not.toBeNull();
  });

  it("direct messages are private to the two people and notify the other once", async () => {
    const id = ok(await dev.client.rpc("open_direct_chat", { p_org: org.A, p_user: viewer.id }), "open");
    expect(ok(await viewer.client.rpc("open_direct_chat", { p_org: org.A, p_user: dev.id }), "same chat")).toBe(id);
    ran(await dev.client.from("chat_messages").insert({ organization_id: org.A, channel_id: id, body: "Got a minute?" }), "dm 1");
    ran(await dev.client.from("chat_messages").insert({ organization_id: org.A, channel_id: id, body: "About WEB-37" }), "dm 2");
    expect(ok(await pm.client.from("chat_messages").select("id").eq("channel_id", id), "pm")).toHaveLength(0);
    const notes = ok(await admin.from("notifications").select("id").eq("user_id", viewer.id).eq("kind", "chat_message").eq("entity_id", id), "notes");
    expect(notes).toHaveLength(1);

    const overview = ok(await viewer.client.rpc("chat_overview", { p_org: org.A }), "overview");
    expect(overview.find((c: { id: string; unread: number }) => c.id === id)?.unread).toBe(2);
    ran(await viewer.client.rpc("mark_chat_read", { p_channel: id }), "read");
    const after = ok(await viewer.client.rpc("chat_overview", { p_org: org.A }), "overview after");
    expect(after.find((c: { id: string; unread: number }) => c.id === id)?.unread).toBe(0);

    expect((await dev.client.rpc("open_direct_chat", { p_org: org.A, p_user: outsider.id })).error).not.toBeNull();
  });

  it("groups only take members of the organization", async () => {
    const id = ok(await dev.client.rpc("create_group_chat", { p_org: org.A, p_name: "Launch", p_members: [viewer.id, outsider.id] }), "group");
    const people = ok(await dev.client.from("chat_members").select("user_id").eq("channel_id", id), "members").map((m) => m.user_id);
    expect(people.sort()).toEqual([dev.id, viewer.id].sort());
    expect(ok(await pm.client.from("chat_channels").select("id").eq("id", id), "pm")).toHaveLength(0);
    ran(await viewer.client.from("chat_members").delete().eq("channel_id", id).eq("user_id", viewer.id), "leave");
    expect(ok(await viewer.client.from("chat_channels").select("id").eq("id", id), "after leaving")).toHaveLength(0);
  });
});

describe("review and project notifications", () => {
  const notes = async (userId: string, kind: string, entity: string) =>
    ok(await admin.from("notifications").select("title").eq("user_id", userId).eq("kind", kind).eq("entity_id", entity), kind);

  it("moving a task into Review asks owners, admins and project managers; finishing it tells the assignee", async () => {
    const task = ok(await newTask(owner, "A", project.P1, "Review me", { assignee_id: dev.id }), "task");
    ran(await dev.client.from("tasks").update({ status_id: opt.A["task_status:Review"] }).eq("id", task.id), "to review");
    expect(await notes(owner.id, "review_requested", task.id)).toHaveLength(1);
    expect(await notes(pm.id, "review_requested", task.id)).toHaveLength(1);
    expect(await notes(viewer.id, "review_requested", task.id)).toHaveLength(0);

    ran(await owner.client.from("tasks").update({ status_id: opt.A["task_status:In progress"] }).eq("id", task.id), "send back");
    expect(await notes(dev.id, "changes_requested", task.id)).toHaveLength(1);

    ran(await dev.client.from("tasks").update({ status_id: opt.A["task_status:Review"] }).eq("id", task.id), "review again");
    ran(await owner.client.from("tasks").update({ status_id: opt.A["task_status:Done"] }).eq("id", task.id), "approve");
    expect(await notes(dev.id, "review_approved", task.id)).toHaveLength(1);
  });

  it("the inviter hears when an invitation is accepted", async () => {
    const rows = ok(await admin.from("notifications").select("title").eq("user_id", owner.id).eq("kind", "invite_accepted"), "accepted");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("email categories default on, except chat", async () => {
    const p = ok(
      await dev.client.from("profiles").select("email_assignments, email_reviews, email_deadlines, email_comments, email_projects, email_chat").eq("id", dev.id).single(),
      "prefs",
    );
    expect(p).toEqual({ email_assignments: true, email_reviews: true, email_deadlines: true, email_comments: true, email_projects: true, email_chat: false });
  });
});

describe("admin console", () => {
  const db = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

  it("refuses everyone who is not a platform admin", async () => {
    expect((await owner.client.rpc("admin_stats")).error?.code).toBe("42501");
    expect((await owner.client.rpc("admin_list_users", {})).error?.code).toBe("42501");
    expect((await owner.client.rpc("admin_set_user_suspended", { p_user: dev.id, p_suspended: true })).error?.code).toBe("42501");
    expect(ok(await owner.client.from("admin_audit_log").select("id"), "audit")).toHaveLength(0);
  });

  // Needs a direct database connection to grant admin access; CI has only the API keys.
  it.skipIf(!process.env.SUPABASE_DB_URL)("a platform admin can see numbers, suspend and restore an account, and it is logged", async () => {
    const client = db();
    await client.connect();
    try {
      await client.query("insert into private.platform_admins (email) values ($1) on conflict do nothing", [ownerB.email]);
      const stats = ok(await ownerB.client.rpc("admin_stats"), "stats") as Record<string, number>;
      expect(stats.users).toBeGreaterThan(0);
      const found = ok(await ownerB.client.rpc("admin_list_users", { p_search: outsider.email }), "search");
      expect(found.map((u: { id: string }) => u.id)).toEqual([outsider.id]);

      ran(await ownerB.client.rpc("admin_set_user_suspended", { p_user: outsider.id, p_suspended: true }), "suspend");
      const banned = async () => (await client.query("select banned_until from auth.users where id = $1", [outsider.id])).rows[0].banned_until;
      expect(await banned()).not.toBeNull();
      ran(await ownerB.client.rpc("admin_set_user_suspended", { p_user: outsider.id, p_suspended: false }), "restore");
      expect(await banned()).toBeNull();

      const log = ok(await ownerB.client.from("admin_audit_log").select("action").eq("actor_id", ownerB.id), "log");
      expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(["user_suspended", "user_restored"]));
      // Metadata only: being a platform admin grants no access to organization content.
      expect(ok(await ownerB.client.from("tasks").select("id").eq("organization_id", org.A), "content")).toHaveLength(0);
    } finally {
      await client.query("delete from private.platform_admins where email = $1", [ownerB.email]);
      await client.query("delete from public.admin_audit_log where actor_id = $1", [ownerB.id]);
      await client.end();
    }
  });
});
