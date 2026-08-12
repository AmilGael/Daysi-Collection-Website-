import { emailEnabled, env } from "./env";
import { formatMoney } from "./money";
import { forNotification } from "./security";
import { saveRequest, type StoredRequest } from "./request-store";

/**
 * How Daysi hears that something came in. Email if a key is configured;
 * otherwise the request is still saved and still visible in the owner inbox,
 * and the failure is logged rather than shown to the client — a notification
 * that did not send is not the client's problem, and their request is safe.
 */

const KIND_LABELS: Record<StoredRequest["kind"], string> = {
  alteration: "Alteration request",
  order: "Order",
  commission: "Custom commission",
  appointment: "Appointment booking",
  contact: "Message",
  "premiere-signup": "Premiere sign-up",
};

export function summarise(request: StoredRequest): string {
  const lines: string[] = [
    `${KIND_LABELS[request.kind]} · ${request.reference}`,
    "",
    `Name:      ${forNotification(request.client.name)}`,
    `Email:     ${forNotification(request.client.email)}`,
  ];

  if (request.client.phone) lines.push(`Phone:     ${forNotification(request.client.phone)}`);
  if (request.client.preferredContact) {
    lines.push(`Reply via: ${request.client.preferredContact}`);
  }
  lines.push(`Language:  ${request.locale === "es" ? "Español" : "English"}`, "");

  for (const [key, value] of Object.entries(request.details)) {
    const rendered = Array.isArray(value) ? value.join(", ") : String(value);
    lines.push(`${key}: ${forNotification(rendered)}`);
  }

  if (request.estimate) {
    lines.push("", "Estimate");
    for (const line of request.estimate.lines) {
      lines.push(`  ${line.label.en} — ${formatMoney(line.amount, "en")}`);
    }
    lines.push(`  Total — ${formatMoney(request.estimate.total, "en")}`);
    lines.push(`  Due now — ${formatMoney(request.estimate.dueNow, "en")}`);
  }

  if (request.photoFile) lines.push("", `Photo attached: ${request.photoFile}`);

  return lines.join("\n");
}

/**
 * The one place mail leaves this application. Never throws: a message that
 * could not be sent is logged, and the caller decides what that means for the
 * client in front of them.
 */
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!emailEnabled) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.notificationFrom ?? `Daysi Collection <no-reply@${new URL(env.siteUrl).hostname}>`,
        to: [message.to],
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      console.error(`[mail] Provider rejected a message: ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] Could not send a message", error);
    return false;
  }
}

export async function notifyOwner(request: StoredRequest): Promise<void> {
  if (!emailEnabled) {
    console.info(`[notify] ${request.kind} ${request.reference} saved; email not configured.`);
    return;
  }

  await sendEmail({
    to: env.ownerEmail!,
    replyTo: request.client.email,
    subject: `${KIND_LABELS[request.kind]} — ${request.client.name} (${request.reference})`,
    text: summarise(request),
  });
}

/**
 * Stores a request and tells Daysi about it, and keeps the two failures apart:
 * a disk that cannot be written (a read-only serverless filesystem, a full
 * volume) must not stop the notification, because the email IS the request as
 * far as Daysi is concerned. Returns false only when the request reached
 * neither the store nor a configured mailbox — the one case where telling the
 * client "sent" would be a lie.
 */
export async function recordRequest(request: StoredRequest): Promise<boolean> {
  let stored = true;
  try {
    await saveRequest(request);
  } catch (error) {
    stored = false;
    console.error(`[store] Could not persist ${request.reference}`, error);
  }

  await notifyOwner(request);
  return stored || emailEnabled;
}
