import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function Home() {
  return <LandingPage signedIn={Boolean(await getUserId())} />;
}
