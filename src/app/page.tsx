import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: "mso-pm · Project management for software studios" },
  description: "Plan projects, tasks, issues, releases, clients and docs across all your organizations with one login.",
};

export default async function Home() {
  return <LandingPage signedIn={Boolean(await getUserId())} />;
}
