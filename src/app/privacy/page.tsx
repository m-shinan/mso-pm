import { CONTACT_EMAIL } from "@/features/landing/landing-page";
import { LegalPage } from "@/features/legal/legal-page";

export const metadata = { title: "Privacy policy", description: "What mso-pm collects, why, who processes it, and the choices you have.", alternates: { canonical: "/privacy" } };

// Plain-language starting point. Have it reviewed before relying on it legally.
export default function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      title="Privacy policy"
      updated="23 October 2026"
      intro={
        <p>
          This policy explains what mso-pm collects when you use pm.mshinan.com, why, and the choices you have. In short: we keep
          what is needed to run your workspace, we don’t sell it, and you can delete your account at any time.
        </p>
      }
      sections={[
        {
          id: "collect",
          title: "What we collect",
          body: (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Account details: your name, email address and a hashed password.</li>
              <li>Workspace content: the projects, tasks, issues, comments, files and other records you and your teammates create.</li>
              <li>Feedback you send through Request a feature or Report an issue, with the page you were on and your browser name.</li>
              <li>Technical data needed to keep you signed in and the service secure, such as session cookies, and anonymous page-view statistics.</li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <p>
              To run the service: show your workspace, send sign-in, confirmation and notification emails, and keep accounts secure.
              To improve mso-pm, using the feedback you send and aggregate usage statistics. We do not sell your data or use it for
              advertising.
            </p>
          ),
        },
        {
          id: "processors",
          title: "Who processes it",
          body: (
            <p>
              Supabase stores the database and files. Resend delivers our emails. Vercel hosts the app and provides privacy-friendly
              page-view analytics. Each processes data only to provide its service to us.
            </p>
          ),
        },
        {
          id: "sharing",
          title: "Who can see your content",
          body: (
            <p>
              Content in an organization is visible to that organization’s members according to their roles. Other organizations
              cannot see it. We access it only to provide support you ask for, or when the law requires it.
            </p>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <p>
              We keep your account while it is active. When you delete your account, your profile and sign-in details are removed
              straight away. Content you created inside an organization stays with that organization, shown without your name, unless
              an owner deletes it.
            </p>
          ),
        },
        {
          id: "choices",
          title: "Your choices",
          body: (
            <p>
              You can turn off email notifications from the account menu and delete your account from Account › Delete account. To
              ask for a copy of your data, or for anything else about your data, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent">{CONTACT_EMAIL}</a>.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: <p>If we make material changes we will update the date above and let you know by email or in the app.</p>,
        },
      ]}
    />
  );
}
