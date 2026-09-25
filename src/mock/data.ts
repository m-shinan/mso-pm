// Sample data for building the UI before Supabase is wired.
// Dates are relative to "today" so the screens always look current.
// Only the "arclight" organization has content; the others demonstrate empty states.
// Delete this folder once every feature reads from the database.

import type {
  ActivityEvent,
  Client,
  DocumentSummary,
  Issue,
  Member,
  Milestone,
  Option,
  OptionKind,
  Organization,
  Project,
  Release,
  Task,
} from "@/lib/types";

const DAY = 86_400_000;
function day(offset: number): string {
  const d = new Date(Date.now() + offset * DAY);
  return d.toISOString().slice(0, 10);
}
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const ORGS: Organization[] = [
  { id: "org_arclight", slug: "arclight", name: "Arclight Dev", logoColor: "#1B1B1F", role: "owner", memberCount: 4 },
  { id: "org_kite", slug: "kite-labs", name: "Kite Labs", logoColor: "#2F6B5E", role: "developer", memberCount: 7 },
  { id: "org_personal", slug: "personal", name: "Personal", logoColor: "#7A6440", role: "owner", memberCount: 1 },
];

export const CURRENT_USER_ID = "u_ms";

const TINTS = [
  { bg: "#E3E8F7", fg: "#2B4596" },
  { bg: "#F3E6DA", fg: "#8A4A12" },
  { bg: "#DDEFE7", fg: "#1F6B47" },
  { bg: "#EDE4F5", fg: "#5B3C8C" },
];

export const MEMBERS: Member[] = [
  { id: "u_ms", name: "Muhammed S.", initials: "MS", email: null, role: "owner", status: "active", lastActive: ago(0), tint: TINTS[0] },
  { id: "u_ar", name: "Aisha R.", initials: "AR", email: null, role: "developer", status: "active", lastActive: ago(25), tint: TINTS[1] },
  { id: "u_jk", name: "Jomon K.", initials: "JK", email: null, role: "developer", status: "active", lastActive: ago(120), tint: TINTS[2] },
  { id: "u_fn", name: "Fathima N.", initials: "FN", email: null, role: "admin", status: "active", lastActive: ago(60 * 20), tint: TINTS[3] },
];

// ---- Organization configuration (seeded defaults) -------------------------

type OptSeed = [id: string, name: string, color: string, category: string | null, rank: number | null, usage?: number];
function opts(kind: OptionKind, seeds: OptSeed[], defaultId?: string): Option[] {
  return seeds.map(([id, name, color, category, rank, usage], i) => ({
    id,
    kind,
    name,
    color,
    category,
    rank,
    sortOrder: i,
    isDefault: id === defaultId,
    isActive: true,
    usage,
  }));
}

export const OPTIONS: Option[] = [
  ...opts("project_type", [
    ["pt_ecom", "E-commerce", "#2B4596", null, null],
    ["pt_erp", "ERP", "#1F6B47", null, null],
    ["pt_menu", "Digital menu", "#8A4A12", null, null],
    ["pt_lms", "LMS", "#5B3C8C", null, null],
    ["pt_web", "Website", "#45454C", null, null],
    ["pt_mobile", "Mobile app", "#45454C", null, null],
    ["pt_webapp", "Web app", "#45454C", null, null],
    ["pt_custom", "Custom", "#45454C", null, null],
  ]),
  ...opts("project_status", [
    ["ps_planning", "Planning", "#8A8A92", "planned", null],
    ["ps_active", "In progress", "#C27A06", "active", null],
    ["ps_review", "Client review", "#7654C9", "active", null],
    ["ps_hold", "On hold", "#B5B4AF", "paused", null],
    ["ps_done", "Completed", "#2F8F5B", "completed", null],
  ], "ps_planning"),
  ...opts("task_status", [
    ["ts_backlog", "Backlog", "#8A8A92", "not_started", null, 41],
    ["ts_todo", "Todo", "#6E6E76", "not_started", null, 37],
    ["ts_progress", "In progress", "#C27A06", "active", null, 18],
    ["ts_review", "Review", "#7654C9", "active", null, 9],
    ["ts_testing", "Testing", "#0E8388", "active", null, 7],
    ["ts_blocked", "Blocked", "#CC3A21", "blocked", null, 3],
    ["ts_done", "Done", "#2F8F5B", "completed", null, 212],
  ], "ts_todo"),
  ...opts("task_priority", [
    ["tp_low", "Low", "#45454C", null, 1],
    ["tp_medium", "Medium", "#45454C", null, 2],
    ["tp_high", "High", "#45454C", null, 3],
    ["tp_urgent", "Urgent", "#D9480F", null, 4],
  ], "tp_medium"),
  ...opts("issue_status", [
    ["is_open", "Open", "#6E6E76", "open", null],
    ["is_progress", "In progress", "#C27A06", "active", null],
    ["is_testing", "Ready for testing", "#0E8388", "active", null],
    ["is_resolved", "Resolved", "#2F8F5B", "resolved", null],
    ["is_closed", "Closed", "#8A8A92", "closed", null],
    ["is_reopened", "Reopened", "#CC3A21", "open", null],
  ], "is_open"),
  ...opts("issue_severity", [
    ["sv_low", "Low", "#6E6E76", null, 1],
    ["sv_medium", "Medium", "#8A6D00", null, 2],
    ["sv_high", "High", "#C2560C", null, 3],
    ["sv_critical", "Critical", "#CC3A21", null, 4],
  ], "sv_medium"),
  ...opts("release_status", [
    ["rs_planned", "Planned", "#8A8A92", "planned", null],
    ["rs_progress", "In progress", "#C27A06", "active", null],
    ["rs_released", "Released", "#2F8F5B", "released", null],
  ], "rs_planned"),
];

// ---- Work data -----------------------------------------------------------

export const CLIENTS: Client[] = [
  { id: "c_karam", name: "Karam Trading", industry: "Retail", contactName: "Yusuf Karam", contactRole: "Owner", email: null, phone: null, notes: "Prefers WhatsApp for quick approvals, email for anything with money.\nInvoices go to accounts, net 15. Hosting renews every June.", lastActivity: ago(25) },
  { id: "c_dune", name: "Dune Café", industry: "Restaurant", contactName: "Layla H.", contactRole: "Manager", email: null, phone: null, notes: null, lastActivity: ago(60) },
  { id: "c_falcon", name: "Falcon Logistics", industry: "Logistics", contactName: "Omar F.", contactRole: "Operations", email: null, phone: null, notes: null, lastActivity: ago(180) },
  { id: "c_noor", name: "Noor Institute", industry: "Education", contactName: "Dr. Sana N.", contactRole: "Director", email: null, phone: null, notes: null, lastActivity: ago(60 * 24) },
  { id: "c_medix", name: "Medix Clinics", industry: "Healthcare", contactName: "Rahul M.", contactRole: "IT lead", email: null, phone: null, notes: null, lastActivity: ago(60 * 24 * 21) },
];

export const PROJECTS: Project[] = [
  { id: "p_skr", key: "SKR", name: "Souq Karam", description: "Online store with Arabic/English catalogue, COD and card payments, delivery tracking.", clientId: "c_karam", typeId: "pt_ecom", statusId: "ps_active", priorityId: "tp_high", startDate: day(-86), dueDate: day(35), tasksDone: 48, tasksTotal: 77, memberIds: ["u_ms", "u_ar", "u_jk", "u_fn"], updatedAt: ago(25), pinned: true },
  { id: "p_dcm", key: "DCM", name: "Dune Café Menu", description: "QR digital menu with Arabic menu, table codes and daily specials.", clientId: "c_dune", typeId: "pt_menu", statusId: "ps_review", priorityId: "tp_high", startDate: day(-60), dueDate: day(8), tasksDone: 44, tasksTotal: 50, memberIds: ["u_ms", "u_jk"], updatedAt: ago(60), pinned: true },
  { id: "p_fer", key: "FER", name: "Falcon ERP", description: "Inventory, purchasing and fleet modules for a logistics company.", clientId: "c_falcon", typeId: "pt_erp", statusId: "ps_active", priorityId: "tp_medium", startDate: day(-40), dueDate: day(81), tasksDone: 22, tasksTotal: 54, memberIds: ["u_ms", "u_ar"], updatedAt: ago(180), pinned: true },
  { id: "p_nac", key: "NAC", name: "Noor Academy", description: "LMS with courses, quizzes and certificates.", clientId: "c_noor", typeId: "pt_lms", statusId: "ps_active", priorityId: "tp_medium", startDate: day(-20), dueDate: day(117), tasksDone: 8, tasksTotal: 30, memberIds: ["u_ms", "u_fn"], updatedAt: ago(60 * 20), pinned: false },
  { id: "p_ksa", key: "KSA", name: "Karam Shopper app", description: "Mobile companion app for Souq Karam.", clientId: "c_karam", typeId: "pt_mobile", statusId: "ps_planning", priorityId: "tp_low", startDate: day(10), dueDate: day(156), tasksDone: 2, tasksTotal: 17, memberIds: ["u_ms", "u_jk"], updatedAt: ago(60 * 48), pinned: false },
  { id: "p_mdx", key: "MDX", name: "Medix Portal", description: "Appointment booking portal for clinics.", clientId: "c_medix", typeId: "pt_webapp", statusId: "ps_hold", priorityId: "tp_low", startDate: day(-120), dueDate: null, tasksDone: 29, tasksTotal: 53, memberIds: ["u_ms"], updatedAt: ago(60 * 24 * 21), pinned: false },
];

type TaskSeed = [project: string, n: number, title: string, status: string, prio: string, assignee: string | null, due: number | null, labels: string[], extra?: Partial<Task>];
function t([project, n, title, status, prio, assignee, due, labels, extra]: TaskSeed): Task {
  return {
    id: `t_${project}_${n}`,
    projectId: project,
    number: n,
    title,
    statusId: status,
    priorityId: prio,
    assigneeId: assignee,
    dueDate: due === null ? null : day(due),
    labels,
    checklist: null,
    blockedReason: null,
    releaseId: null,
    ...extra,
  };
}

export const TASKS: Task[] = ([
  ["p_skr", 142, "Integrate shipping rate API", "ts_progress", "tp_urgent", "u_ms", -2, ["API"], { checklist: { done: 3, total: 5 }, releaseId: "r_skr_120" }],
  ["p_skr", 147, "Coupon rules: minimum basket and category", "ts_progress", "tp_high", "u_ar", 4, ["Backend"], { releaseId: "r_skr_120" }],
  ["p_skr", 149, "Order tracking page", "ts_review", "tp_medium", "u_jk", 6, ["Frontend"], { releaseId: "r_skr_120" }],
  ["p_skr", 139, "Checkout address autocomplete", "ts_review", "tp_high", "u_fn", 0, ["Frontend"], { releaseId: "r_skr_120" }],
  ["p_skr", 140, "Admin: bulk price update from CSV", "ts_review", "tp_medium", "u_ms", 5, ["Admin"]],
  ["p_skr", 133, "Pay-in-installments option at checkout", "ts_testing", "tp_high", "u_fn", 2, ["Payments"], { checklist: { done: 6, total: 6 }, releaseId: "r_skr_120" }],
  ["p_skr", 136, "Search filters: size and colour", "ts_testing", "tp_medium", "u_jk", 5, ["Frontend"], { releaseId: "r_skr_120" }],
  ["p_skr", 144, "Sync stock levels from warehouse system", "ts_blocked", "tp_high", "u_ar", 1, ["API"], { blockedReason: "Waiting on client: ERP API keys", releaseId: "r_skr_120" }],
  ["p_skr", 150, "Product image zoom on mobile", "ts_todo", "tp_low", "u_jk", 1, ["Frontend"]],
  ["p_skr", 151, "Wishlist sync for guest users", "ts_todo", "tp_medium", "u_ar", 7, ["API"]],
  ["p_skr", 153, "Invoice PDF with VAT breakdown", "ts_todo", "tp_high", "u_ms", 11, ["Backend"], { releaseId: "r_skr_120" }],
  ["p_skr", 155, "Abandoned cart reminder email", "ts_todo", "tp_medium", null, null, ["Backend"]],
  ["p_skr", 156, "Gift wrapping option", "ts_backlog", "tp_low", null, null, ["Frontend"]],
  ["p_skr", 157, "Loyalty points", "ts_backlog", "tp_medium", null, null, ["Backend"]],
  ["p_skr", 131, "Arabic product slugs", "ts_done", "tp_medium", "u_jk", -6, ["Frontend"]],
  ["p_dcm", 37, "QR code generator for table cards", "ts_review", "tp_high", "u_ms", 0, ["Frontend"]],
  ["p_dcm", 38, "Daily specials banner", "ts_todo", "tp_medium", "u_jk", 3, ["Frontend"]],
  ["p_fer", 58, "Purchase order approval flow", "ts_todo", "tp_high", "u_ms", 0, ["Backend"]],
  ["p_fer", 61, "Supplier price lists import", "ts_progress", "tp_medium", "u_ar", 6, ["Backend"]],
  ["p_nac", 19, "Quiz timer and auto-submit", "ts_testing", "tp_medium", "u_ms", 0, ["Frontend"]],
  ["p_nac", 14, "Course import from spreadsheet", "ts_done", "tp_medium", "u_fn", -9, ["Backend"]],
] as TaskSeed[]).map(t);

type IssueSeed = [project: string, n: number, title: string, status: string, sev: string, prio: string, assignee: string | null, env: string, hoursAgo: number];
function i([project, n, title, status, sev, prio, assignee, env, hoursAgo]: IssueSeed): Issue {
  return {
    id: `i_${project}_${n}`,
    projectId: project,
    number: n,
    title,
    statusId: status,
    severityId: sev,
    priorityId: prio,
    assigneeId: assignee,
    reporterId: "u_jk",
    environment: env,
    steps: [],
    expected: "",
    actual: "",
    relatedTaskId: null,
    releaseId: null,
    createdAt: ago(hoursAgo * 60),
  };
}

export const ISSUES: Issue[] = ([
  ["p_skr", 88, "Checkout fails on Apple Pay for saved cards", "is_progress", "sv_critical", "tp_urgent", "u_ms", "Production · iOS 17, Safari", 2],
  ["p_fer", 72, "Stock goes negative after a partial return", "is_open", "sv_critical", "tp_high", "u_ar", "Staging", 24],
  ["p_nac", 23, "Arabic RTL layout breaks on the course player", "is_testing", "sv_high", "tp_high", "u_fn", "Production", 48],
  ["p_dcm", 41, "Menu shows old prices after cache purge", "is_testing", "sv_high", "tp_medium", "u_jk", "Production", 72],
  ["p_skr", 91, "Wrong sort order in “New arrivals”", "is_open", "sv_medium", "tp_medium", null, "Production", 96],
  ["p_ksa", 12, "Push notification opens a blank screen on Android 14", "is_open", "sv_medium", "tp_medium", "u_jk", "Beta", 120],
  ["p_fer", 70, "PO export CSV is missing supplier VAT number", "is_open", "sv_medium", "tp_low", "u_ar", "Staging", 168],
  ["p_mdx", 18, "Typo in footer link on booking page", "is_open", "sv_low", "tp_low", null, "Production", 336],
  ["p_nac", 25, "Certificate PDF falls back to default font", "is_open", "sv_low", "tp_low", "u_fn", "Staging", 340],
] as IssueSeed[]).map(i);

Object.assign(ISSUES[0], {
  reporterId: "u_jk",
  steps: [
    "Sign in with an account that has a saved Visa card.",
    "Add any item to the cart and open checkout.",
    "Choose Apple Pay and confirm with Face ID.",
  ],
  expected: "Payment completes and the order confirmation page opens.",
  actual: "Spinner for ~20 s, then “Payment not completed”. Card is charged.",
  releaseId: "r_skr_120",
});

export const RELEASES: Release[] = [
  { id: "r_skr_120", projectId: "p_skr", version: "v1.2.0", name: "Payments & delivery", statusId: "rs_progress", releaseDate: day(12), changelog: { added: ["Pay in installments at checkout", "Address autocomplete on checkout", "Search filters for size and colour"], changed: ["Coupons support a minimum basket and category rules"], fixed: ["Wrong sort order in “New arrivals”"] } },
  { id: "r_fer_100", projectId: "p_fer", version: "v1.0.0", name: "Inventory + purchasing", statusId: "rs_progress", releaseDate: day(19), changelog: { added: [], changed: [], fixed: [] } },
  { id: "r_nac_030", projectId: "p_nac", version: "v0.3.0", name: "Quizzes", statusId: "rs_planned", releaseDate: day(41), changelog: { added: [], changed: [], fixed: [] } },
  { id: "r_dcm_230", projectId: "p_dcm", version: "v2.3.0", name: "Table QR codes", statusId: "rs_released", releaseDate: day(-1), changelog: { added: ["Table QR codes"], changed: [], fixed: [] } },
  { id: "r_skr_110", projectId: "p_skr", version: "v1.1.0", name: "Wishlist", statusId: "rs_released", releaseDate: day(-23), changelog: { added: ["Wishlist"], changed: [], fixed: [] } },
];

export const MILESTONES: Milestone[] = [
  { id: "m_fer_purch", projectId: "p_fer", name: "Purchasing module", dueDate: day(-15) },
  { id: "m_fer_inv", projectId: "p_fer", name: "Inventory module", dueDate: day(19) },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: "a1", actorId: "u_ar", verb: "moved", subject: "SKR-144", detail: "to Blocked", projectId: "p_skr", at: ago(25) },
  { id: "a2", actorId: "u_jk", verb: "reported", subject: "SKR-88", detail: "Checkout fails on Apple Pay", projectId: "p_skr", at: ago(120) },
  { id: "a3", actorId: "u_fn", verb: "commented on", subject: "NAC-19", detail: "“Timer resets on refresh”", projectId: "p_nac", at: ago(60 * 20) },
  { id: "a4", actorId: "u_ms", verb: "released", subject: "DCM v2.3.0", detail: "to production", projectId: "p_dcm", at: ago(60 * 22) },
  { id: "a5", actorId: "u_ms", verb: "moved the deadline of", subject: "Falcon ERP", detail: "to a later date", projectId: "p_fer", at: ago(60 * 48) },
  { id: "a6", actorId: "u_ar", verb: "created", subject: "SKR-151", detail: "Wishlist sync for guest users", projectId: "p_skr", at: ago(60 * 50) },
  { id: "a7", actorId: "u_ms", verb: "added", subject: "Fathima N.", detail: "to Noor Academy", projectId: "p_nac", at: ago(60 * 72) },
];

export const DOCUMENTS: DocumentSummary[] = [
  { id: "d1", projectId: "p_skr", title: "Deployment notes", updatedBy: "u_ms", updatedAt: ago(60 * 72) },
  { id: "d2", projectId: "p_skr", title: "Payment gateway integration", updatedBy: "u_fn", updatedAt: ago(60 * 30) },
  { id: "d3", projectId: "p_skr", title: "Client requirements", updatedBy: "u_ms", updatedAt: ago(60 * 24 * 40) },
  { id: "d4", projectId: "p_fer", title: "Inventory data model", updatedBy: "u_ar", updatedAt: ago(60 * 24 * 5) },
  { id: "d5", projectId: "p_dcm", title: "Menu import format", updatedBy: "u_jk", updatedAt: ago(60 * 24 * 12) },
];
