"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

/** Never shows raw errors: logs the detail, tells the user what to do. */
export default function OrgError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[mso-pm] page error", error.digest ?? "", error);
  }, [error]);
  return (
    <main className="px-4 py-8 lg:px-8">
      <ErrorState message="This page couldn’t load. Check your connection and try again." action={<Button size="sm" onClick={retry}>Retry</Button>} />
    </main>
  );
}
