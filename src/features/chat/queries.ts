import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ChatChannel {
  id: string;
  kind: "general" | "project" | "group" | "direct";
  name: string | null;
  projectId: string | null;
  otherUserId: string | null;
  lastMessageAt: string | null;
  unread: number;
}

/** Every channel the signed-in user can see in an organization, with unread counts. */
export async function listChannels(orgId: string): Promise<ChatChannel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_overview", { p_org: orgId });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    kind: c.kind as ChatChannel["kind"],
    name: c.name,
    projectId: c.project_id,
    otherUserId: c.other_user_id,
    lastMessageAt: c.last_message_at,
    unread: c.unread,
  }));
}

/** For the sidebar badge. Never fails the page: chat is secondary there. */
export async function chatUnreadTotal(orgId: string): Promise<number> {
  try {
    return (await listChannels(orgId)).reduce((n, c) => n + c.unread, 0);
  } catch {
    return 0;
  }
}
