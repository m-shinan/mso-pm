import { ArrowRight, Check, FileText, Flag, FolderKanban, Globe, Mail, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { HOME } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const CONTACT_EMAIL = "mshinan2002@gmail.com";
export const PORTFOLIO_URL = "https://mshinan.com";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FolderKanban, title: "Projects & boards", body: "Board and list views with your own statuses, priorities and labels. Drag tasks between columns." },
  { icon: TriangleAlert, title: "Issues", body: "Report bugs with severity and steps, link them to tasks, and see what is still open per project." },
  { icon: Flag, title: "Releases & milestones", body: "Group work into milestones, ship releases, and keep a changelog your clients can read." },
  { icon: Users, title: "Clients", body: "Keep contacts, notes and every project for a client together in one record." },
  { icon: FileText, title: "Docs", body: "Setup guides, decisions and handover notes, written next to the work they describe." },
  { icon: ShieldCheck, title: "Teams & roles", body: "Invite people by email, give them a role per organization, and override it per project." },
];

const STEPS = [
  { title: "Create your account", body: "Sign up with your email and confirm it from the link we send." },
  { title: "Create or join an organization", body: "Start a workspace for your studio, or accept an invitation from a team." },
  { title: "Invite your team", body: "Add people with the right role, create your first project and start planning." },
];

const SECURITY = [
  "Row-level access rules on every table",
  "Owner, admin, project manager, developer and viewer roles",
  "Email-confirmed accounts and single-use invitations",
  "Sign-ins expire after 30 days; delete your account any time",
];

const BOARD = [
  { name: "Todo", dot: "bg-ink-5", cards: [["Write release notes", "WEB-41", "AR"], ["Cookie banner copy", "WEB-44", "JK"]] },
  { name: "In progress", dot: "bg-accent", cards: [["Checkout redesign", "WEB-37", "MS"], ["Image CDN migration", "WEB-39", "LT"]] },
  { name: "Review", dot: "bg-warn-ink", cards: [["Product page performance", "WEB-33", "AR"]] },
  { name: "Done", dot: "bg-success", cards: [["New navigation", "WEB-29", "JK"], ["Analytics events", "WEB-31", "MS"]] },
];

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[16px] font-semibold">
      <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-[7px] bg-accent text-[13px] font-bold text-white">m</span>
      mso-pm
    </Link>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <span className="text-sm font-medium text-accent">{eyebrow}</span>
      <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">{title}</h2>
    </div>
  );
}

/** Public home page. Signed-in visitors get "Open dashboard" instead of sign in / sign up. */
export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const primary = buttonClass("primary", "lg", "px-5");
  const secondary = buttonClass("secondary", "lg", "px-5 border-line-strong");
  return (
    <div className="min-h-dvh bg-canvas text-[15px] leading-[1.55] text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-3 px-4 py-3 sm:px-6">
          <SiteLogo />
          <nav aria-label="Sections" className="flex grow flex-wrap gap-x-5 gap-y-1 text-md text-ink-2 max-sm:order-last max-sm:w-full">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#security" className="hover:text-ink">Security</a>
            <a href="#contact" className="hover:text-ink">Contact</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Link href={HOME} className={buttonClass("primary", "md", "h-10 px-4 text-md")}>
                Open dashboard <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "md", "h-10 px-3.5 text-md")}>Sign in</Link>
                <Link href="/signup" className={buttonClass("primary", "md", "h-10 px-4 text-md")}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-22">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2">
            <span aria-hidden className="size-[7px] rounded-full bg-success" />
            Project management for software studios
          </span>
          <h1 className="max-w-[820px] text-[38px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[56px] lg:text-[64px]">
            Every project, task and release in one calm place.
          </h1>
          <p className="max-w-[620px] text-[17px] text-ink-3 sm:text-[18px]">
            Plan work across all your organizations with one login. Track tasks, issues, releases, clients and docs, with roles
            that decide who can see and change what.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            {signedIn ? (
              <Link href={HOME} className={primary}>Go to your dashboard</Link>
            ) : (
              <Link href="/signup" className={primary}>Create an account</Link>
            )}
            <a href="#features" className={secondary}>See what’s inside</a>
          </div>
        </section>

        <section aria-label="Product preview" className="mx-auto max-w-[1200px] px-4 pt-4 pb-20 sm:px-6 sm:pb-24">
          <div aria-hidden className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_24px_60px_rgb(20_20_24/0.10)]">
            <div className="flex items-center gap-2 border-b border-line-soft bg-sunken px-4 py-3">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="ml-3 truncate rounded-md bg-subtle px-3 py-0.5 font-mono text-xs text-ink-4">pm.mshinan.com/acme/projects/WEB</span>
            </div>
            <div className="flex">
              <div className="hidden w-[220px] shrink-0 flex-col gap-1 border-r border-line-soft bg-sunken px-3.5 py-4 text-base text-ink-2 md:flex">
                <span className="mb-2 flex items-center gap-2 px-2 py-1.5 font-semibold text-ink">
                  <span className="inline-flex size-[22px] items-center justify-center rounded-md bg-inverse text-2xs text-on-inverse">A</span>
                  Acme Studio
                </span>
                {["Dashboard", "My tasks", "Projects", "Issues", "Releases", "Clients", "Docs"].map((n) => (
                  <span key={n} className={cn("rounded-md px-2 py-1.5", n === "Projects" && "bg-accent-soft font-medium text-accent-hover")}>{n}</span>
                ))}
              </div>
              <div className="min-w-0 grow px-5 pt-5 pb-6 text-left">
                <div className="mb-4 flex items-baseline gap-2.5">
                  <span className="font-mono text-xs text-ink-4">WEB</span>
                  <span className="text-xl font-semibold">Website relaunch</span>
                </div>
                <div className="flex gap-3 overflow-x-auto">
                  {BOARD.map((col) => (
                    <div key={col.name} className="flex min-w-[190px] flex-1 flex-col gap-2 rounded-[10px] bg-column p-2.5">
                      <span className="flex items-center gap-2 px-1 text-sm font-medium text-ink-2">
                        <span className={cn("size-2 rounded-full", col.dot)} />
                        {col.name}
                      </span>
                      {col.cards.map(([title, key, who]) => (
                        <div key={key} className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
                          <span className="text-base">{title}</span>
                          <span className="flex items-center text-xs text-ink-4">
                            <span className="font-mono">{key}</span>
                            <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">{who}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-y border-line bg-surface">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
            <SectionHeading eyebrow="Features" title="Everything a studio ships, tracked from one sidebar." />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <article key={title} className="flex flex-col gap-2.5 rounded-xl border border-line bg-sunken p-6">
                  <span className="inline-flex size-9 items-center justify-center rounded-[9px] bg-accent-soft text-accent-hover">
                    <Icon aria-hidden className="size-[18px]" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-1 text-[17px] font-semibold">{title}</h3>
                  <p className="text-[14.5px] text-ink-3">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto flex max-w-[1200px] scroll-mt-16 flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
          <SectionHeading eyebrow="How it works" title="Up and running in three steps." />
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-6">
                <span className="font-mono text-sm text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-[17px] font-semibold">{s.title}</h3>
                <p className="text-[14.5px] text-ink-3">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="security" className="mx-auto max-w-[1200px] scroll-mt-16 px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="flex flex-wrap items-center gap-x-12 gap-y-8 rounded-2xl bg-[#1b1b1f] p-8 text-[#ececee] sm:p-12">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
              <h2 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em]">Private by default.</h2>
              <p className="text-[15.5px] text-[#a6a6ad]">
                Each organization’s data is walled off in the database itself, not just hidden in the interface. Roles decide who
                can view, edit or invite.
              </p>
            </div>
            <ul className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 text-[14.5px]">
              {SECURITY.map((s) => (
                <li key={s} className="flex items-start gap-2.5">
                  <Check aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[#6ccb94]" strokeWidth={2} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="contact" className="scroll-mt-16 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-x-16 gap-y-8 px-4 py-20 sm:px-6 sm:py-24">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
              <span className="text-sm font-medium text-accent">Contact</span>
              <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">Questions, ideas, or a project in mind?</h2>
              <p className="max-w-[460px] text-[16px] text-ink-3">
                Write any time. Already using mso-pm? Use Request a feature or Report an issue from the account menu and it lands
                straight in our inbox.
              </p>
            </div>
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
              <ContactCard href={`mailto:${CONTACT_EMAIL}`} icon={Mail} label="Email" value={CONTACT_EMAIL} />
              <ContactCard href={PORTFOLIO_URL} icon={Globe} label="Portfolio" value="mshinan.com" />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function ContactCard({ href, icon: Icon, label, value }: { href: string; icon: LucideIcon; label: string; value: string }) {
  return (
    <a href={href} className="flex items-center gap-3.5 rounded-xl border border-line bg-sunken px-5 py-4 hover:border-line-strong">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-hover">
        <Icon aria-hidden className="size-[18px]" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-ink-4">{label}</span>
        <span className="truncate text-[16px] font-medium">{value}</span>
      </span>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-7 text-base text-ink-3 sm:px-6">
        <span>© {new Date().getFullYear()} mso-pm</span>
        <nav aria-label="Legal" className="ml-auto flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">Contact</a>
          <a href={PORTFOLIO_URL} className="hover:text-ink">mshinan.com</a>
        </nav>
      </div>
    </footer>
  );
}

