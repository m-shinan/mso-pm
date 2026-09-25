import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyOrgs } from "@/features/org/queries";

/** Send the user to their last organization, or to onboarding if they have none. */
export default async function Home() {
  const orgs = await listMyOrgs();
  if (orgs.length === 0) redirect("/onboarding");
  const last = (await cookies()).get("last_org")?.value;
  const target = orgs.find((o) => o.slug === last) ?? orgs[0];
  redirect(`/${target.slug}`);
}
