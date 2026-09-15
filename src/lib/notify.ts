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
  // The reply, one tap away: a wa.me link with the client's number opens the
  // conversation straight from the notification on Daysi's phone.
  if (request.client.phone) {
    const digits = request.client.phone.replace(/[^0-9]/g, "");
    if (digits.length >= 7) lines.push(`WhatsApp:  https://wa.me/${digits}`);
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

  if (paidByStripe(request)) {
    lines.push(
      "",
      `Paid by ${request.paidVia === "bank" ? "bank transfer" : "card"}: ${formatMoney(request.estimate?.dueNow ?? 0, "en")} — confirmed by Stripe.`,
    );
  }

  if (request.paymentFailed) {
    lines.push(
      "",
      `Bank payment refused: ${formatMoney(request.estimate?.dueNow ?? 0, "en")} was not received.`,
      "The client has been told. Ask them for another way to pay.",
    );
  }

  return lines.join("\n");
}

/**
 * Only Stripe's own line counts: a status Daysi set by hand is not a
 * confirmed payment. Nor is a line the refusal landed on — that line carries
 * her Pagado forward, and the money is exactly what did not arrive.
 */
function paidByStripe(request: StoredRequest): boolean {
  return request.status === "paid" && request.source === "stripe" && !request.paymentFailed;
}

function subjectPrefix(request: StoredRequest): string {
  if (request.paymentFailed) return "PAYMENT REFUSED · ";
  if (paidByStripe(request)) return "PAID · ";
  return "";
}

/**
 * The one place mail leaves this application. Never throws: a message that
 * could not be sent is logged, and the caller decides what that means for the
 * client in front of them.
 */
export async function sendEmail(message: {
  to: string | readonly string[];
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
        to: [message.to].flat(),
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
    to: env.ownerEmails,
    replyTo: request.client.email,
    subject: `${subjectPrefix(request)}${KIND_LABELS[request.kind]} — ${request.client.name} (${request.reference})`,
    text: summarise(request),
  });
}

/**
 * The one message the site sends a client on its own: their bank refused the
 * debit days after they were told the payment was on its way, so silence
 * would leave them waiting for a piece nobody is making. Written in the
 * language they used on the site; replies go to Daysi.
 */
export async function notifyClientPaymentFailed(request: StoredRequest): Promise<void> {
  if (!emailEnabled) {
    console.info(`[notify] ${request.reference} bank payment refused; client email not configured.`);
    return;
  }

  const amount = formatMoney(request.estimate?.dueNow ?? 0, request.locale);
  const name = forNotification(request.client.name);
  const message =
    request.locale === "es"
      ? {
          subject: `Su pago no llegó · ${request.reference}`,
          text: [
            `Hola ${name},`,
            "",
            `Su banco no envió el pago de ${amount} de la solicitud ${request.reference}, así que no se cobró nada.`,
            "",
            "Daysi ya fue avisada y le escribirá para acordar otra forma de pagar. También puede responder a este correo.",
            "",
            "Daysi Collection",
          ].join("\n"),
        }
      : {
          subject: `Your payment did not go through · ${request.reference}`,
          text: [
            `Hello ${name},`,
            "",
            `Your bank did not send the payment of ${amount} for request ${request.reference}, so nothing was charged.`,
            "",
            "Daysi has been told and will write to you about another way to pay. You can also reply to this email.",
            "",
            "Daysi Collection",
          ].join("\n"),
        };

  await sendEmail({
    to: request.client.email,
    ...(env.ownerEmails[0] ? { replyTo: env.ownerEmails[0] } : {}),
    ...message,
  });
}

/**
 * Stores a request and tells Daysi about it, and keeps the two failures apart:
 * a disk that cannot be written (a read-only serverless filesystem, a full
 * volume) must not stop the notification, because the email IS the request as
 * far as Daysi is concerned. Returns false only when the request reached
 * neither the store nor a configured mailbox — the one case where telling the
 * client "sent" would be a lie.
 *
 * A request still waiting on a card payment is the exception: it is stored and
 * nothing more. Daysi hears about it from `markPaid`, when Stripe confirms the
 * money, so a client who reaches the payment page and stops has not put an
 * order in her inbox. For such a request the store is the only place it can
 * live — the webhook looks the reference up there — so a failed write is a
 * failed request.
 */
export async function recordRequest(request: StoredRequest): Promise<boolean> {
  let stored = true;
  try {
    await saveRequest(request);
  } catch (error) {
    stored = false;
    console.error(`[store] Could not persist ${request.reference}`, error);
  }

  if (request.awaitingPayment) {
    if (stored) console.info(`[notify] ${request.kind} ${request.reference} held until Stripe confirms.`);
    return stored;
  }

  await notifyOwner(request);
  return stored || emailEnabled;
}
