"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { useOrg } from "./org-provider";

export function AccountMenu({ compact }: { compact?: boolean }) {
  const { member, currentUserId } = useOrg();
  const router = useRouter();
  const [pending, start] = useTransition();
  const me = member(currentUserId);

  return (
    <Menu>
      <MenuTrigger
        aria-label="Account"
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-left hover:bg-subtle",
          compact ? "size-11 justify-center" : "w-full px-2 py-1.5",
        )}
      >
        <Avatar person={me} size={compact ? "lg" : "md"} />
        {compact ? null : (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{me?.name}</span>
            <span className="truncate text-2xs text-ink-4">{me?.email}</span>
          </span>
        )}
      </MenuTrigger>
      <MenuContent align={compact ? "end" : "start"} label="Account" className="w-60">
        <MenuLabel>{me?.email}</MenuLabel>
        <MenuItem onSelect={() => router.push("/account/password")}>
          <KeyRound aria-hidden className="size-4 text-ink-4" /> Change password
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => start(() => signOut())}>
          <LogOut aria-hidden className="size-4 text-ink-4" /> {pending ? "Signing out…" : "Sign out"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
