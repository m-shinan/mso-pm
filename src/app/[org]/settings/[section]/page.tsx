import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { requireOrg } from "@/features/org/queries";
import { GeneralSettings } from "@/features/settings/general";
import { LabelsEditor } from "@/features/settings/labels-editor";
import { OptionsEditor } from "@/features/settings/options-editor";
import { RolesEditor } from "@/features/settings/roles-editor";
import { OPTION_SECTIONS } from "@/features/settings/sections";
import { listRoles } from "@/features/team/queries";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsSectionPage({ params }: PageProps<"/[org]/settings/[section]">) {
  const { section: slug } = await params;
  const { org, ctx } = await requireOrg(params);
  const supabase = await createClient();

  const section = OPTION_SECTIONS.find((s) => s.slug === slug);
  if (section) {
    // The one screen that shows archived options and how many records use each.
    const { data } = await supabase.rpc("option_usage", { p_org: org.id });
    const usage = Object.fromEntries((data ?? []).map((r) => [r.option_id, Number(r.uses)]));
    const options = ctx.options.filter((o) => o.kind === section.kind);
    return <OptionsEditor key={section.slug} section={section} initial={options} usage={usage} />;
  }

  if (slug === "general") return <GeneralSettings />;

  if (slug === "labels") {
    const { data, error } = await supabase
      .from("labels")
      .select("id, name, color, is_active, uses:task_labels(count)")
      .eq("organization_id", org.id)
      .order("name");
    if (error) throw error;
    const labels = (data ?? []).map(({ uses, ...l }) => ({ ...l, uses: (uses as unknown as { count: number }[])[0]?.count ?? 0 }));
    return <LabelsEditor initial={labels} />;
  }

  if (slug === "members") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-base text-ink-3">Invite people, change roles and remove members on the Team page.</p>
        <Link href={`/${org.slug}/team`} className={buttonClass("secondary", "md", "self-start max-lg:h-11")}>Open Team</Link>
      </div>
    );
  }

  if (slug === "roles") return <RolesEditor initial={await listRoles(org.id)} />;

  notFound();
}
