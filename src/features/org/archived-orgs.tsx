"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Organizations you own that were archived — restore brings them back for everyone. */
export function ArchivedOrgs({ orgs }: { orgs: { id: string; name: string; slug: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  if (orgs.length === 0) return null;

  async function restore(id: string, slug: string) {
    const { error: dbError } = await supabaseBrowser().rpc("set_organization_archived", { p_org: id, p_archived: false });
    if (dbError) return setError(friendlyError(dbError, "restore the organization"));
    router.replace(`/${slug}`);
    router.refresh();
  }

  return (
    <section className="mt-6 flex w-full max-w-[600px] flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink-2">Archived organizations</h2>
      {error ? <p role="alert" className="text-sm text-danger-ink">{error}</p> : null}
      {orgs.map((o) => (
        <div key={o.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5">
          <span className="grow font-medium">{o.name}</span>
          <Button size="sm" onClick={() => restore(o.id, o.slug)} className="max-lg:h-10">Restore</Button>
        </div>
      ))}
    </section>
  );
}
