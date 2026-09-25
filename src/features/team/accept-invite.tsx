"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const { data, error: dbError } = await supabaseBrowser().rpc("accept_invitation", { p_token: token });
    if (dbError || !data) {
      setBusy(false);
      return setError(friendlyError(dbError, "accept the invitation"));
    }
    router.replace(`/${data}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState message={error} /> : null}
      <Button variant="primary" onClick={accept} disabled={busy} className="self-start max-lg:h-11">
        {busy ? "Joining…" : "Accept and join"}
      </Button>
    </div>
  );
}
