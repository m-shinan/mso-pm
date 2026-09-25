"use client";

import { KeyRound, LogOut, Mail, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { signOut } from "@/features/auth/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useOrg } from "./org-provider";

export function AccountMenu({ compact }: { compact?: boolean }) {
  const { member, currentUserId } = useOrg();
  const router = useRouter();
  const [pending, start] = useTransition();
  const me = member(currentUserId);
  const theme = useTheme();
  const toast = useToast();
  // Loaded when the menu first opens; null until then.
  const [emails, setEmails] = useState<boolean | null>(null);

  async function loadEmails(open: boolean) {
    if (!open || emails !== null) return;
    const { data } = await supabaseBrowser().from("profiles").select("email_notifications").eq("id", currentUserId).single();
    if (data) setEmails(data.email_notifications);
  }

  async function toggleEmails(on: boolean) {
    setEmails(on);
    const { error } = await supabaseBrowser().from("profiles").update({ email_notifications: on }).eq("id", currentUserId);
    if (error) {
      setEmails(!on);
      toast({ message: "Couldn’t save that. Try again." });
    }
  }

  return (
    <Menu onOpenChange={loadEmails}>
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
        <MenuCheckboxItem checked={emails ?? false} disabled={emails === null} onCheckedChange={toggleEmails}>
          <Mail aria-hidden className="size-4 text-ink-4" /> Email notifications
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
          <MenuRadioItem value="system"><Monitor aria-hidden className="size-4 text-ink-4" /> System</MenuRadioItem>
          <MenuRadioItem value="light"><Sun aria-hidden className="size-4 text-ink-4" /> Light</MenuRadioItem>
          <MenuRadioItem value="dark"><Moon aria-hidden className="size-4 text-ink-4" /> Dark</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={() => start(() => signOut())}>
          <LogOut aria-hidden className="size-4 text-ink-4" /> {pending ? "Signing out…" : "Sign out"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
