import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CreateOrgForm } from "@/features/org/create-org-form";

export const metadata = { title: "Create organization" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pb-10">
      <div className="flex h-14 items-center self-stretch lg:px-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </Link>
      </div>
      <CreateOrgForm />
    </div>
  );
}
