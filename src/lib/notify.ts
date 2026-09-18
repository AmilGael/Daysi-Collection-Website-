import { readFileSync } from "node:fs";
import { translate } from "@/content";
import { emailEnabled, env } from "./env";
import { formatMoney } from "./money";
import { forNotification } from "./security";
import { requestPhotoPath, saveRequest, type StoredRequest } from "./request-store";
import { whatsappLink } from "./whatsapp";

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
  design: "Design request",
};

export function summarise(request: StoredRequest): string {
  const lines: string[] = [
    `${KIND_LABELS[request.kind]} · ${request.reference}`,
    "",
    `Name:      ${request.client.name ? forNotification(request.client.name) : "No name given"}`,
    `Email:     ${forNotification(request.client.email)}`,
  ];

  // No phone on file: Daysi cannot text or call, so the note says as much and
  // she knows to reply by email instead.
  if (request.client.phone) lines.push(`Phone:     ${forNotification(request.client.phone)}`);
  else lines.push("No phone given");
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
 * How a message to the client opens: a name, when there is one — nothing
 * invented when there is not. "Hola," and "Hello," read as complete
 * sentences on their own; a stand-in word ("client", "cliente") would be
 * worse than leaving it out, since it announces that the name was missing
 * rather than just not mentioning one.
 */
function greeting(name: string, locale: "es" | "en"): string {
  const word = locale === "es" ? "Hola" : "Hello";
  return name ? `${word} ${name},` : `${word},`;
}

/**
 * The name slot in the owner's subject line: the client's name, or their
 * email when they left none, so the line never reads with a gap ("Order —
 *  (ORD-1)") where a name should be — an email is still a way to tell one
 * guest from the next at a glance.
 */
function subjectName(request: StoredRequest): string {
  return request.client.name || request.client.email;
}

/** A file sent with a message: its name, and its bytes as base64, as Resend takes them. */
export type EmailAttachment = { readonly filename: string; readonly content: string };

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
  attachments?: readonly EmailAttachment[];
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
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
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

/**
 * The photo stored with a request, ready to travel with Daysi's email: a
 * design's mockup is the whole of what the client sent, and an alteration's
 * snapshot saves her asking for one. A file that cannot be read costs the
 * attachment, never the message — she can still open the photo in the Hub.
 */
function photoAttachment(request: StoredRequest): EmailAttachment[] {
  if (!request.photoFile) return [];
  try {
    const content = readFileSync(requestPhotoPath(request.photoFile)).toString("base64");
    return [{ filename: request.photoFile, content }];
  } catch (error) {
    console.error(`[notify] Could not attach the photo for ${request.reference}`, error);
    return [];
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
    subject: `${subjectPrefix(request)}${KIND_LABELS[request.kind]} — ${subjectName(request)} (${request.reference})`,
    text: summarise(request),
    attachments: photoAttachment(request),
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
            greeting(name, "es"),
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
            greeting(name, "en"),
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
 * What comes next, in the client's own words: an appointment names the day
 * and the hour that was booked; a studio design says Daysi will answer with
 * a quote; everything else falls back to the reason the estimate itself
 * gives for what was charged now.
 */
function whatsNext(request: StoredRequest): string {
  const { locale } = request;
  if (request.kind === "design") {
    return locale === "es"
      ? "Daysi revisa su diseño y le escribe con una cotización."
      : "Daysi will look at your design and write to you with a quote.";
  }
  if (request.kind === "appointment") {
    const date = request.details.date;
    const startTime = request.details.startTime;
    if (typeof date === "string" && typeof startTime === "string") {
      const when = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(`${date}T12:00:00`));
      return locale === "es"
        ? `Su cita es el ${when} a las ${startTime}.`
        : `Your appointment is on ${when} at ${startTime}.`;
    }
  }
  return request.estimate ? translate(request.estimate.dueNowReason, locale) : "";
}

/**
 * The client's own receipt: every line they are being charged for, what was
 * paid now and what is still owed, and what happens next. Split from
 * `notifyClientPaid` so the tests can check the words without going through
 * `sendEmail`.
 */
export function receiptMessage(request: StoredRequest): { subject: string; text: string } {
  const { locale } = request;
  const name = forNotification(request.client.name);
  const estimate = request.estimate;
  const lines = estimate?.lines ?? [];

  const itemLines = lines.map((line) => {
    const qty = line.unitAmount ? Math.round(line.amount / line.unitAmount) : 1;
    const label = line.note ? `${translate(line.label, locale)} (${translate(line.note, locale)})` : translate(line.label, locale);
    return `${label} × ${qty} — ${formatMoney(line.amount, locale)}`;
  });

  const subtotal = estimate?.subtotal ?? 0;
  const salesTax = estimate?.salesTax ?? 0;
  const total = estimate?.total ?? 0;
  const dueNow = estimate?.dueNow ?? 0;
  const dueOnCollection = estimate?.dueOnCollection ?? 0;
  const byBank = request.paidVia === "bank";
  const via = locale === "es" ? (byBank ? "banco" : "tarjeta") : byBank ? "bank" : "card";

  const whatsapp = whatsappLink(
    locale === "es"
      ? `Hola Daysi, sobre mi pedido ${request.reference}`
      : `Hi Daysi, about my order ${request.reference}`,
  );
  const ordersUrl = `${env.siteUrl}/${locale}/account/orders`;

  const text =
    locale === "es"
      ? [
          greeting(name, "es"),
          "",
          ...itemLines,
          "",
          `Subtotal: ${formatMoney(subtotal, "es")}`,
          ...(salesTax > 0 ? [`Impuesto: ${formatMoney(salesTax, "es")}`] : []),
          `Total: ${formatMoney(total, "es")}`,
          "",
          `Pagado ahora (${via}): ${formatMoney(dueNow, "es")}`,
          ...(dueOnCollection > 0 ? [`Pendiente al recoger: ${formatMoney(dueOnCollection, "es")}`] : []),
          "",
          `Referencia: ${request.reference}`,
          "",
          "Qué sigue",
          whatsNext(request),
          "",
          `¿Preguntas? Escríbanos por WhatsApp: ${whatsapp}`,
          `Vea sus pedidos: ${ordersUrl}`,
          "",
          "Daysi Collection",
        ].join("\n")
      : [
          greeting(name, "en"),
          "",
          ...itemLines,
          "",
          `Subtotal: ${formatMoney(subtotal, "en")}`,
          ...(salesTax > 0 ? [`Tax: ${formatMoney(salesTax, "en")}`] : []),
          `Total: ${formatMoney(total, "en")}`,
          "",
          `Paid now (${via}): ${formatMoney(dueNow, "en")}`,
          ...(dueOnCollection > 0 ? [`Due on collection: ${formatMoney(dueOnCollection, "en")}`] : []),
          "",
          `Reference: ${request.reference}`,
          "",
          "What's next",
          whatsNext(request),
          "",
          `Questions? Reach us on WhatsApp: ${whatsapp}`,
          `See your orders: ${ordersUrl}`,
          "",
          "Daysi Collection",
        ].join("\n");

  return {
    subject: locale === "es" ? `Su recibo · ${request.reference}` : `Your receipt · ${request.reference}`,
    text,
  };
}

/**
 * The receipt Stripe's confirmation buys the client: the thank-you page
 * promises it is "on its way to your inbox", and this is what makes that
 * true. Sent once, from `markPaid`, never from the form itself — a client who
 * only reached the payment page has not paid, and must not be told they were
 * charged.
 */
export async function notifyClientPaid(request: StoredRequest): Promise<void> {
  if (!emailEnabled) {
    console.info(`[notify] ${request.reference} paid; client receipt not sent, email not configured.`);
    return;
  }

  await sendEmail({
    to: request.client.email,
    ...(env.ownerEmails[0] ? { replyTo: env.ownerEmails[0] } : {}),
    ...receiptMessage(request),
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
