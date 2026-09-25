// The main flows, driven like a person would: keyboard, mouse, a phone screen.
// Every change is also checked in the database, not just on screen.
import { expect, test, type Page } from "@playwright/test";
import { admin, readData, type E2EData } from "./data";

// Written by setup.ts, which runs after this file is loaded.
let d: E2EData;
let board: string;
test.beforeAll(() => {
  d = readData();
  board = `/${d.orgSlug}/projects/web`;
});

async function taskRow(title: string) {
  const { data } = await admin().from("tasks").select("id, status_id").eq("organization_id", d.orgId).eq("title", title).maybeSingle();
  return data;
}

// Any console error or uncaught exception fails the test that caused it.
let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
});
test.afterEach(() => {
  expect(problems, problems.join("\n")).toEqual([]);
});

const column = (page: Page, status: string) => page.getByRole("listitem", { name: new RegExp(`^${status}, \\d+ tasks$`) });

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("protected pages redirect to sign in, and a wrong password is refused", async ({ page }) => {
    await page.goto(`/${d.orgSlug}`);
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill(d.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
  });
});

test("the dashboard shows the organization's real data", async ({ page }) => {
  await page.goto(`/${d.orgSlug}`);
  await expect(page.getByRole("link", { name: /Website/ }).first()).toBeVisible();
  await expect(page.getByText("Active projects").first()).toBeVisible();
});

test("create a task with the C shortcut", async ({ page }) => {
  await page.goto(board);
  await expect(column(page, "Todo")).toBeVisible();
  await page.keyboard.press("c");
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill("Write release notes");
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(column(page, "Todo").getByRole("button", { name: /Write release notes/ })).toBeVisible();
  expect((await taskRow("Write release notes"))?.status_id).toBe(d.options["task_status:Todo"]);
});

test("drag a task to another column", async ({ page }) => {
  await page.goto(board);
  const card = page.getByRole("button", { name: "WEB-1 Seed task" });
  const target = column(page, "In progress");
  await expect(card).toBeVisible();
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  // Grab the card by its key (the title is a link), then move in steps so the drag sensor engages.
  await page.mouse.move(from.x + 12, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
  await page.mouse.up();
  await expect(target.getByRole("button", { name: "WEB-1 Seed task" })).toBeVisible();
  await expect.poll(async () => (await taskRow("Seed task"))?.status_id).toBe(d.options["task_status:In progress"]);
});

test("open a task and comment on it", async ({ page }) => {
  await page.goto(board);
  // The title link sits inside the draggable card, so find it as a plain link.
  await page.locator("a", { hasText: "Seed task" }).click();
  await expect(page).toHaveURL(/task=web-1/);
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Write a comment").fill("Looks good from here.");
  await drawer.getByRole("button", { name: "Comment" }).click();
  await expect(drawer.getByText("Looks good from here.")).toBeVisible();
  await expect
    .poll(async () => (await admin().from("comments").select("body").eq("organization_id", d.orgId)).data?.map((c) => c.body))
    .toContain("Looks good from here.");
});

test("report an issue", async ({ page }) => {
  await page.goto(`/${d.orgSlug}/issues`);
  await page.getByRole("main").getByRole("button", { name: "Report issue" }).click();
  const dialog = page.getByRole("dialog", { name: "Report an issue" });
  await dialog.getByLabel(/What.s wrong/).fill("Checkout button does nothing");
  await dialog.getByRole("button", { name: "Report issue" }).click();
  await expect(page.getByText("Checkout button does nothing").first()).toBeVisible();
});

test("add a label in settings", async ({ page }) => {
  await page.goto(`/${d.orgSlug}/settings/labels`);
  await page.getByLabel("New label name").fill("Needs design");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Name of Needs design")).toBeVisible();
});

test("someone else's change appears without reloading", async ({ page }) => {
  await page.goto(board);
  await expect(column(page, "Todo")).toBeVisible();
  // Give the live connection a moment to attach before the change happens.
  await page.waitForTimeout(2500);
  const { error } = await admin().from("tasks").insert({
    organization_id: d.orgId, project_id: d.projectId, title: "Added by a teammate", reporter_id: d.mateId,
    status_id: d.options["task_status:Todo"], priority_id: d.options["task_priority:Medium"], number: 0,
  });
  expect(error).toBeNull();
  await expect(column(page, "Todo").getByRole("button", { name: /Added by a teammate/ })).toBeVisible({ timeout: 15_000 });
});

test("dark mode can be chosen and is remembered", async ({ page }) => {
  await page.goto(`/${d.orgSlug}`);
  const html = page.locator("html");
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("works on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${d.orgSlug}`);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  // Nothing wider than the screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
