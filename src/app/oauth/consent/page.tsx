import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata = { title: "Connect an app" };

/**
 * Supabase Auth's OAuth server sends people here when an MCP client (ChatGPT,
 * Claude, Cursor…) asks to act on their behalf. The decision is posted to
 * /oauth/decision, which sends them back to the client.
 */
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const sp = await searchParams;
  const id = typeof sp.authorization_id === "string" ? sp.authorization_id : "";
  if (!(await getUserId())) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const supabase = await createClient();
  const { data, error } = id ? await supabase.auth.oauth.getAuthorizationDetails(id) : { data: null, error: true };
  // Already approved earlier: straight back to the client.
  if (data && !("authorization_id" in data)) redirect(data.redirect_url);

  let body: React.ReactNode;
  if (error || !data) {
    body = <p className="text-base text-ink-2">This sign-in request isn’t valid or has expired. Start again from the app you were connecting.</p>;
  } else {
    body = (
      <>
        <p className="text-base leading-normal text-ink-2">
          <span className="font-medium text-ink">{data.client.name || "An app"}</span> wants to use mso-pm as{" "}
          <span className="font-medium text-ink">{data.user.email}</span>. It will be able to see your organizations, projects
          and tasks, and to create and change tasks and comments, with the same access you have.
        </p>
        <p className="text-sm text-ink-3">It will return you to {new URL(data.redirect_uri).origin}.</p>
        <form method="post" action="/oauth/decision" className="flex gap-2">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button name="decision" value="approve" className={buttonClass("primary", "md", "max-lg:h-11")}>Allow</button>
          <button name="decision" value="deny" className={buttonClass("secondary", "md", "max-lg:h-11")}>Deny</button>
        </form>
      </>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold">Connect an app</h1>
        {body}
      </div>
    </div>
  );
}
