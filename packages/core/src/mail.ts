import nodemailer from "nodemailer";
import { env } from "./env";
import { enqueue, QUEUES } from "./jobs";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Queue an email; the worker delivers it. Never blocks a request on SMTP. */
export const queueMail = (mail: Mail) => enqueue(QUEUES.sendEmail, mail);

let transport: nodemailer.Transporter | null = null;

/** Called by the worker. With no SMTP_URL configured, mail is logged instead of sent. */
export async function deliverMail(mail: Mail) {
  if (!env.smtpUrl) {
    console.info(`[mail] (no SMTP_URL) to=${mail.to} subject=${JSON.stringify(mail.subject)}`);
    return;
  }
  transport ??= nodemailer.createTransport(env.smtpUrl);
  await transport.sendMail({ from: env.mailFrom, ...mail });
}

/** Minimal branded HTML wrapper so every email looks like it came from the same product. */
export function mailHtml(opts: { heading: string; body: string; actionLabel?: string; actionUrl?: string; footer?: string }) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const action = opts.actionUrl
    ? `<p style="margin:24px 0"><a href="${esc(opts.actionUrl)}" style="background:#2A5FE6;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500">${esc(opts.actionLabel ?? "Open")}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F7F6F3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1C1B19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E4E1DA;border-radius:10px">
<tr><td style="padding:28px 32px"><h1 style="font-size:20px;margin:0 0 12px;font-weight:600">${esc(opts.heading)}</h1>
<div style="font-size:15px;line-height:1.55">${opts.body}</div>${action}
<p style="font-size:12px;color:#6B675F;margin:24px 0 0">${esc(opts.footer ?? "You received this because of your account settings.")}</p></td></tr></table>
</td></tr></table></body></html>`;
}
