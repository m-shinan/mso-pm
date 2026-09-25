import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { requireOrg } from "@/features/org/queries";
import { GeneralSettings } from "@/features/settings/general";
import { OptionsEditor } from "@/features/settings/options-editor";
import { OPTION_SECTIONS } from "@/features/settings/sections";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";
import type { RoleKey } from "@/lib/types";

export default async function SettingsSectionPage({ params }: PageProps<"/[org]/settings/[section]">) {
  const { section: slug } = await params;
  const { org, ctx } = await requireOrg(params);

  const section = OPTION_SECTIONS.find((s) => s.slug === slug);
  if (section) {
    // Settings is the one screen that also loads archived options and usage counts.
    const options = ctx.options.filter((o) => o.kind === section.kind);
    return <OptionsEditor key={section.slug} section={section} initial={options} />;
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
    const roles = Object.keys(DEFAULT_ROLE_PERMISSIONS) as RoleKey[];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">Roles &amp; permissions</h1>
          <p className="max-w-xl text-base leading-normal text-ink-3">
            What each role can do in {org.name}. A member can also get a different role on a single project. The database enforces these; hiding a button is only a convenience.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-sunken text-xs text-ink-4">
              <tr>
                <th scope="col" className="px-3.5 py-2 text-left font-medium">Permission</th>
                {roles.map((r) => <th key={r} scope="col" className="px-2 py-2 font-medium">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p} className="border-t border-line-soft">
                  <th scope="row" className="px-3.5 py-2 text-left font-mono text-xs font-normal text-ink-2">{p}</th>
                  {roles.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      {DEFAULT_ROLE_PERMISSIONS[r].includes(p) ? <span aria-label="Allowed" className="text-[#2F8F5B]">✓</span> : <span aria-label="Not allowed" className="text-ink-6">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  notFound();
}
