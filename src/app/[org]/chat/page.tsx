import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/ui/states";
import { ChatApp } from "@/features/chat/chat-app";
import { listChannels } from "@/features/chat/queries";
import { requireOrg } from "@/features/org/queries";
import { friendlyError } from "@/lib/errors";

export const metadata = { title: "Chat" };

export default async function ChatPage({ params, searchParams }: PageProps<"/[org]/chat">) {
  const { org } = await requireOrg(params);
  const sp = await searchParams;
  let channels;
  try {
    channels = await listChannels(org.id);
  } catch (e) {
    return (
      <main className="px-4 py-8 lg:px-8">
        <ErrorState message={friendlyError(e, "load chat")} />
      </main>
    );
  }
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Chat" }]} />
      <ChatApp initialChannels={channels} initialChannelId={typeof sp.c === "string" ? sp.c : null} />
    </>
  );
}
