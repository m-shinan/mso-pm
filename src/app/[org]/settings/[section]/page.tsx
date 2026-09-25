import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { requireOrg } from "@/features/org/queries";
import { GeneralSettings } from "@/features/settings/general";
import { OptionsEditor } from "@/features/settings/options-editor";
import { OPTION_SECTIONS } from "@/features/settings/sections";
import { listRoles } from "@/features/team/queries";
import { PERMISSION_LABELS, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsSectionPage({ params }: PageProps<"/[org]/settings/[section]">) {
  const { section: slug } = await params;
  const { org, ctx } = await requireOrg(params);

  const section = OPTION_SECTIONS.find((s) => s.slug === slug);
  if (section) {
    // The one screen that shows archived options and how many records use each.
    const supabase = await createClient();
    const { data } = await supabase.rpc("option_usage", { p_org: org.id });
    const usage = Object.fromEntries((data ?? []).map((r) => [r.option_id, Number(r.uses)]));
    const options = ctx.options.filter((o) => o.kind === section.kind);
    return <OptionsEditor key={section.slug} section={section} initial={options} usage={usage} />;
  }

  if (slug === "general") return <GeneralSettings />;

  if (slug === "members") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-base text-ink-3">Invite people, change roles and remove members on the Team page.</p>
        <Link href={`/${org.slug}/team`} className={buttonClass("secondary", "md", "self-start max-lg:h-11")}>Open Team</Link>
      </div>
    );
  }

  if (slug === "roles") {
    const roles = await listRoles(org.id);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">Roles &amp; permissions</h1>
          <p className="max-w-xl text-base leading-normal text-ink-3">
            What each role can do in {org.name}. A member can also get a different role on a single project. The database enforces these;
            hiding a button is only a convenience.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-sunken text-xs text-ink-4">
              <tr>
                <th scope="col" className="px-3.5 py-2 text-left font-medium">Permission</th>
                {roles.map((r) => <th key={r.id} scope="col" className="px-2 py-2 font-medium">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p} className="border-t border-line-soft">
                  <th scope="row" className="px-3.5 py-2 text-left font-normal">
                    <span className="block text-ink">{PERMISSION_LABELS[p]}</span>
                    <span className="font-mono text-2xs text-ink-4">{p}</span>
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} className="px-2 py-2 text-center">
                      {r.permissions.includes(p) ? <span aria-label="Allowed" className="text-[#2F8F5B]">✓</span> : <span aria-label="Not allowed" className="text-ink-6">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line-soft">
                <th scope="row" className="px-3.5 py-2 text-left font-normal text-ink-3">Read projects they’re a member of</th>
                {roles.map((r) => <td key={r.id} className="px-2 py-2 text-center text-[#2F8F5B]">✓</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  notFound();
}
