import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-sm text-ink-4">404</p>
      <h1 className="text-2xl font-semibold">Nothing here</h1>
      <p className="max-w-sm text-base text-ink-3">
        This page doesn’t exist, or it belongs to an organization you’re not a member of.
      </p>
      <Link href="/" className={buttonClass("secondary", "md", "mt-2 max-lg:h-11")}>Go to your dashboard</Link>
    </div>
  );
}
