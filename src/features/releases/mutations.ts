"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export async function createRelease(r: { organizationId: string; projectId: string; version: string; name: string; statusId: string; releaseDate: string | null }) {
  return supabaseBrowser()
    .from("releases")
    .insert({
      organization_id: r.organizationId,
      project_id: r.projectId,
      version: r.version.trim(),
      name: r.name.trim(),
      status_id: r.statusId,
      release_date: r.releaseDate || null,
    })
    .select("id")
    .single();
}

/** Mark released: status + timestamp, and a changelog drafted from completed tasks if it's empty. */
export async function markReleased(
  releaseId: string,
  releasedStatusId: string,
  changelog: { added: string[]; changed: string[]; fixed: string[] },
) {
  return supabaseBrowser()
    .from("releases")
    .update({ status_id: releasedStatusId, released_at: new Date().toISOString(), changelog })
    .eq("id", releaseId)
    .select("id")
    .single();
}
