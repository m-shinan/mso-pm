// Org-scoped access to the sample data. Mirrors how RLS will behave: an org only
// ever sees its own rows. Only "org_arclight" has data.
import * as D from "./data";

const EMPTY = {
  members: [] as typeof D.MEMBERS,
  clients: [] as typeof D.CLIENTS,
  projects: [] as typeof D.PROJECTS,
  tasks: [] as typeof D.TASKS,
  issues: [] as typeof D.ISSUES,
  releases: [] as typeof D.RELEASES,
  milestones: [] as typeof D.MILESTONES,
  activity: [] as typeof D.ACTIVITY,
  documents: [] as typeof D.DOCUMENTS,
};

export function dataset(orgId: string) {
  if (orgId !== "org_arclight") {
    const me = D.MEMBERS.find((m) => m.id === D.CURRENT_USER_ID)!;
    return { ...EMPTY, members: [me] };
  }
  return {
    members: D.MEMBERS,
    clients: D.CLIENTS,
    projects: D.PROJECTS,
    tasks: D.TASKS,
    issues: D.ISSUES,
    releases: D.RELEASES,
    milestones: D.MILESTONES,
    activity: D.ACTIVITY,
    documents: D.DOCUMENTS,
  };
}
