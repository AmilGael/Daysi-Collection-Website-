import { business } from "@/content";
import { emailEnabled, env } from "./env";
import { formatMoney } from "./money";
import { forNotification } from "./security";
import type { StoredRequest } from "./request-store";

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

export async function notifyOwner(request: StoredRequest): Promise<void> {
  if (!emailEnabled) {
    console.info(`[notify] ${request.kind} ${request.reference} saved; email not configured.`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.notificationFrom ?? `Daysi Collection <no-reply@${new URL(env.siteUrl).hostname}>`,
        to: [env.ownerEmail],
        reply_to: request.client.email,
        subject: `${KIND_LABELS[request.kind]} — ${request.client.name} (${request.reference})`,
        text: summarise(request),
      }),
    });

    if (!response.ok) {
      console.error(`[notify] Resend rejected ${request.reference}: ${response.status}`);
    }
  } catch (error) {
    console.error(`[notify] Could not send ${request.reference}`, error);
  }
}

/**
 * A pre-filled WhatsApp message the client can send with one tap. WhatsApp is
 * how Daysi's clients already reach her, so the site offers it beside every
 * form rather than instead of one.
 */
export function whatsappLink(message: string): string {
  const number = business.whatsapp.replace(/[^0-9]/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
