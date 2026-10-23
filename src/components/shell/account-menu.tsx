"use client";

import { Download, Inbox, KeyRound, Lightbulb, LogOut, Mail, Monitor, Moon, Settings, ShieldCheck, Sun, TriangleAlert, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { signOut } from "@/features/auth/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { IosInstallDialog } from "@/components/pwa";
import { FeedbackDialog, type FeedbackKind } from "@/features/feedback/feedback-dialog";
import { promptInstall, useInstallState } from "@/lib/install-prompt";
import { playChime, setSoundEnabled, soundEnabled } from "@/lib/notify-sound";
import { useOrg } from "./org-provider";

export function AccountMenu({ compact }: { compact?: boolean }) {
  const { org, member, currentUserId, isPlatformAdmin: isAdmin } = useOrg();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>("feature");
  const install = useInstallState();
  const [iosInstall, setIosInstall] = useState(false);
  // Per-device; read when the menu opens (localStorage isn't available on the server).
  const [sound, setSound] = useState(true);
  const router = useRouter();
  const [pending, start] = useTransition();
  const me = member(currentUserId);
  const theme = useTheme();
  const toast = useToast();
  // Loaded when the menu first opens; null until then.
  const [emails, setEmails] = useState<boolean | null>(null);

  async function loadEmails(open: boolean) {
    if (open) setSound(soundEnabled());
    if (!open || emails !== null) return;
    const { data } = await supabaseBrowser().from("profiles").select("email_notifications").eq("id", currentUserId).single();
    if (data) setEmails(data.email_notifications);
  }

  function openFeedback(kind: FeedbackKind) {
    setFeedbackKind(kind);
    setFeedbackOpen(true);
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
    <>
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
        <MenuItem onSelect={() => router.push("/account")}>
          <Settings aria-hidden className="size-4 text-ink-4" /> Account settings
        </MenuItem>
        <MenuItem onSelect={() => router.push("/account/password")}>
          <KeyRound aria-hidden className="size-4 text-ink-4" /> Change password
        </MenuItem>
        <MenuCheckboxItem checked={emails ?? false} disabled={emails === null} onCheckedChange={toggleEmails}>
          <Mail aria-hidden className="size-4 text-ink-4" /> Email notifications
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={sound}
          onCheckedChange={(on) => {
            setSound(on);
            setSoundEnabled(on);
            if (on) playChime();
          }}
        >
          <Volume2 aria-hidden className="size-4 text-ink-4" /> Notification sound
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
          <MenuRadioItem value="system"><Monitor aria-hidden className="size-4 text-ink-4" /> System</MenuRadioItem>
          <MenuRadioItem value="light"><Sun aria-hidden className="size-4 text-ink-4" /> Light</MenuRadioItem>
          <MenuRadioItem value="dark"><Moon aria-hidden className="size-4 text-ink-4" /> Dark</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={() => openFeedback("feature")}>
          <Lightbulb aria-hidden className="size-4 text-ink-4" /> Request a feature
        </MenuItem>
        <MenuItem onSelect={() => openFeedback("issue")}>
          <TriangleAlert aria-hidden className="size-4 text-ink-4" /> Report an issue
        </MenuItem>
        {isAdmin ? (
          <>
            <MenuItem onSelect={() => router.push("/admin")}>
              <ShieldCheck aria-hidden className="size-4 text-ink-4" /> Admin console
            </MenuItem>
            <MenuItem onSelect={() => router.push("/feedback")}>
              <Inbox aria-hidden className="size-4 text-ink-4" /> Feedback inbox
            </MenuItem>
          </>
        ) : null}
        <MenuSeparator />
        {install === "prompt" || install === "ios" ? (
          <MenuItem onSelect={() => (install === "ios" ? setIosInstall(true) : void promptInstall())}>
            <Download aria-hidden className="size-4 text-ink-4" /> Install app
          </MenuItem>
        ) : null}
        <MenuItem onSelect={() => start(() => signOut())}>
          <LogOut aria-hidden className="size-4 text-ink-4" /> {pending ? "Signing out…" : "Sign out"}
        </MenuItem>
      </MenuContent>
    </Menu>
    <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} kind={feedbackKind} onKindChange={setFeedbackKind} organizationId={org.id} />
    <IosInstallDialog open={iosInstall} onOpenChange={setIosInstall} />
    </>
  );
}
