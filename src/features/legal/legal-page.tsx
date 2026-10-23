import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL, PORTFOLIO_URL, SiteFooter, SiteLogo } from "@/features/landing/landing-page";
import { cn } from "@/lib/utils";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Shared layout for /privacy and /terms: contents list on the left, sections on the right. */
export function LegalPage({
  current,
  title,
  updated,
  intro,
  sections,
}: {
  current: "privacy" | "terms";
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-dvh bg-canvas text-[15px] leading-[1.65] text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1080px] items-center gap-4 px-4 py-3.5 sm:px-6">
          <SiteLogo />
          <nav aria-label="Legal" className="ml-auto flex gap-5 text-md">
            <Link href="/privacy" aria-current={current === "privacy" ? "page" : undefined} className={cn(current === "privacy" ? "font-medium text-ink" : "text-ink-3 hover:text-ink")}>Privacy</Link>
            <Link href="/terms" aria-current={current === "terms" ? "page" : undefined} className={cn(current === "terms" ? "font-medium text-ink" : "text-ink-3 hover:text-ink")}>Terms</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1080px] flex-wrap items-start gap-x-16 gap-y-10 px-4 pt-14 pb-24 sm:px-6">
        <nav aria-label="On this page" className="flex flex-[1_1_200px] flex-col gap-1.5 text-base lg:max-w-[240px]">
          <span className="mb-1 text-xs font-medium text-ink-4">ON THIS PAGE</span>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-ink-2 hover:text-accent">{s.title}</a>
          ))}
        </nav>

        <article className="flex max-w-[700px] min-w-0 flex-[999_1_560px] flex-col gap-8">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[40px]">{title}</h1>
            <p className="text-ink-3">Last updated {updated}</p>
            <div className="mt-2 text-ink-2">{intro}</div>
          </div>
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-2.5">
              <h2 className="text-[21px] font-semibold tracking-[-0.015em]">{s.title}</h2>
              <div className="flex flex-col gap-2.5 text-ink-2">{s.body}</div>
            </section>
          ))}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-4">
            <span className="font-medium">Questions?</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent">{CONTACT_EMAIL}</a>
            <a href={PORTFOLIO_URL} className="text-accent">mshinan.com</a>
          </div>
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}
