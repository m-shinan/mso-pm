import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: PageProps<"/[org]/settings">) {
  const { org } = await params;
  redirect(`/${org}/settings/general`);
}
