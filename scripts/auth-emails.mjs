// Branded Supabase Auth emails: 6-digit codes for sign-up and password reset
// (the app has a code step for both), plus "password changed" / "email changed"
// security notices. Uses the Management API with a personal access token.
//   node --env-file=.env.local scripts/auth-emails.mjs          apply
//   node --env-file=.env.local scripts/auth-emails.mjs --show   print the current subjects only
// Deploy the app's code step BEFORE applying: the emails stop containing links.

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be set (see .env.example).");
  process.exit(1);
}
const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const layout = (heading, body, extra = "") => `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1b1b1f;max-width:520px">
<p style="margin:0 0 20px;font-weight:600"><span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#2d55c8;color:#fff;text-align:center;line-height:22px;font-size:12px;margin-right:8px">m</span>mso-pm</p>
<p style="margin:0 0 10px;font-size:18px;font-weight:600">${heading}</p>
<p style="margin:0 0 20px;color:#45454c">${body}</p>
${extra}
<p style="margin:0;font-size:12px;color:#8a8a92">Account email from mso-pm · If this wasn’t you, reply to this email.</p>
</div>`;

const codeBox = `<p style="margin:0 0 20px;font-family:ui-monospace,monospace;font-size:30px;letter-spacing:8px;font-weight:600;background:#f1f0ec;border-radius:10px;padding:14px 18px;display:inline-block">{{ .Token }}</p>
<p style="margin:0 0 20px;font-size:13px;color:#6e6e76">The code expires in 15 minutes. Never share it with anyone.</p>`;

const config = {
  mailer_otp_length: 6,
  mailer_otp_exp: 900,

  mailer_subjects_confirmation: "{{ .Token }} is your mso-pm confirmation code",
  mailer_templates_confirmation_content: layout("Confirm your email", "Enter this code in mso-pm to finish creating your account.", codeBox),

  mailer_subjects_recovery: "{{ .Token }} is your mso-pm password reset code",
  mailer_templates_recovery_content: layout("Reset your password", "Enter this code in mso-pm to choose a new password. If you didn’t ask for this, you can ignore this email.", codeBox),

  mailer_subjects_reauthentication: "{{ .Token }} is your mso-pm verification code",
  mailer_templates_reauthentication_content: layout("Confirm it’s you", "Enter this code in mso-pm to continue.", codeBox),

  mailer_subjects_email_change: "Confirm your new email for mso-pm",
  mailer_templates_email_change_content: layout(
    "Confirm your new email",
    "You asked to change your mso-pm email from {{ .Email }} to {{ .NewEmail }}.",
    `<p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="background:#2d55c8;color:#fff;padding:9px 16px;border-radius:7px;text-decoration:none;font-weight:500">Confirm new email</a></p>`,
  ),

  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: "Your mso-pm password was changed",
  mailer_templates_password_changed_notification_content: layout("Your password was changed", "The password for {{ .Email }} was just changed. If you did this, there’s nothing else to do."),

  mailer_notifications_email_changed_enabled: true,
  mailer_subjects_email_changed_notification: "Your mso-pm email was changed",
  mailer_templates_email_changed_notification_content: layout("Your email was changed", "The email for your mso-pm account was changed from {{ .OldEmail }} to {{ .Email }}."),
};

if (process.argv.includes("--show")) {
  const res = await fetch(url, { headers });
  const c = await res.json();
  for (const k of Object.keys(config)) if (!k.includes("_content")) console.log(k, "=", JSON.stringify(c[k]));
} else {
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(config) });
  if (!res.ok) {
    console.error(`Failed (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  console.log("Auth emails updated: codes for sign-up and reset, security notices on.");
}
