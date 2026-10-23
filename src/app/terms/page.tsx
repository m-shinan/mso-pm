import Link from "next/link";
import { LegalPage } from "@/features/legal/legal-page";

export const metadata = { title: "Terms of use", description: "The terms for using mso-pm, the free project management tool.", alternates: { canonical: "/terms" } };

// Plain-language starting point. Have it reviewed before relying on it legally.
export default function TermsPage() {
  return (
    <LegalPage
      current="terms"
      title="Terms of use"
      updated="23 October 2026"
      intro={<p>These terms apply when you use mso-pm at pm.mshinan.com. By creating an account you agree to them.</p>}
      sections={[
        {
          id: "account",
          title: "Your account",
          body: (
            <p>
              Use a real email address and keep your password to yourself. You are responsible for what happens under your account.
              Tell us straight away if you think someone else has access to it.
            </p>
          ),
        },
        {
          id: "use",
          title: "Acceptable use",
          body: (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Don’t use mso-pm for anything illegal, or to store content you have no right to share.</li>
              <li>Don’t try to access organizations or data you haven’t been invited to, or to break or overload the service.</li>
              <li>Don’t store passwords, payment card numbers or other secrets in tasks, docs or comments.</li>
            </ul>
          ),
        },
        {
          id: "content",
          title: "Your content",
          body: (
            <p>
              You and your organization own what you put into mso-pm. You give us permission to store and process it only so we can run
              the service for you. Organization owners decide who can see and change their organization’s content.
            </p>
          ),
        },
        {
          id: "service",
          title: "The service",
          body: (
            <p>
              We work to keep mso-pm available and your data safe, but the service is provided as is, without guarantees of uptime or
              fitness for a particular purpose. Keep your own copies of anything critical. Features may change over time.
            </p>
          ),
        },
        {
          id: "ending",
          title: "Ending your use",
          body: (
            <p>
              You can delete your account at any time from Account › Delete account. We may suspend accounts that break these terms.
              How we handle your data afterwards is described in the <Link href="/privacy" className="text-accent">privacy policy</Link>.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: <p>If we change these terms in a meaningful way we will update the date above and tell you by email or in the app.</p>,
        },
      ]}
    />
  );
}
