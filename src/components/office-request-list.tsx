"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import type { StoredRequest } from "@/lib/request-store";
import type { WorkChange } from "@/lib/office-validation";
import { whatsappLink } from "@/lib/whatsapp";
import { centsFromInput } from "@/lib/money";
import { chargeable, openPaymentLink } from "@/lib/payment-link";
import { MoneyBox } from "@/components/office/garment-sheet";
import { buttonClass } from "@/components/ui";
import { Pending } from "@/components/office/confirm-bar";
import { OrderNoteCard, type PickerEntry } from "@/components/office/order-note-sheet";
import { RetireButton } from "@/components/office/retired-group";
import { Sheet } from "@/components/office/sheet";
import { UndoLink } from "@/components/office/undo-link";
import { Tag } from "@/components/ui";
import { useOfficeDraft } from "@/components/office/use-office-draft";

const STATUSES = ["new", "answered", "scheduled", "paid", "refunded", "closed"] as const;

/** The groups the work list is read in; any kind not named here is not work. */
const WORK_GROUPS = ["order", "alteration", "commission", "design"] as const;

const card =
  "flex h-full w-full flex-col gap-2 border border-line p-4 text-left transition-colors hover:border-ink";

/**
 * The office's working copy of the request table, as cards: the same
 * information a client sees in their own history, plus the editable status.
 * Tapping a card opens its sheet; changes stay in the tab draft until Daysi
 * confirms them together.
 */
export function OfficeRequestList({
  records,
  locale,
  emptyMessage,
  showOrderNotes = false,
  paymentsEnabled = false,
  clients = [],
}: {
  records: readonly (StoredRequest & { undoable: boolean })[];
  locale: Locale;
  emptyMessage: string;
  /** Only the Trabajo list takes order notes; Citas and Mensajes never do. */
  showOrderNotes?: boolean;
  /** Whether Stripe is on, so a card link can be offered at all. */
  paymentsEnabled?: boolean;
  /** The book, for the order note's client-name box; only the Trabajo list uses it. */
  clients?: readonly PickerEntry[];
}): JSX.Element {
  const t = useTranslations("account");
  const to = useTranslations("office");
  const draft = useOfficeDraft<WorkChange>();
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);

  // A note staged from "+ Anotar un pedido" but not yet confirmed: shown in
  // the grid until Confirmar, the same way Precios and Galería show what
  // they have staged but not yet sent.
  const pendingNotes = showOrderNotes
    ? draft.entries.filter((entry) => entry.change.wire.type === "order-note")
    : [];

  const opened = open !== null ? records.find((record) => record.reference === open) ?? null : null;
  useEffect(() => {
    if (open !== null && !opened) close();
  }, [open, opened, close]);

  const empty = records.length === 0 && pendingNotes.length === 0;
  if (empty && !showOrderNotes) return <EmptyBox message={emptyMessage} />;

  const renderPending = (entry: (typeof pendingNotes)[number]) => {
          const wire = entry.change.wire;
          if (wire.type !== "order-note") return null;
          return (
            <li key={entry.key} className={card}>
              <span className="truncate text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
                {t(`kind.${wire.kind}`)}
              </span>
              <span className="truncate text-[0.9375rem]">{wire.clientName}</span>
              <span className="line-clamp-2 flex-1 text-[0.8125rem] leading-relaxed text-ink-soft">
                {wire.description}
              </span>
              <span className="text-[0.9375rem] tabular-nums">{formatMoney(wire.amount, locale)}</span>
              <span className="mt-auto flex flex-wrap items-center gap-3">
                <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
                <button
                  type="button"
                  onClick={() => draft.unstage(entry.key)}
                  className="text-xs underline underline-offset-4"
                >
                  {to("removePending")}
                </button>
              </span>
            </li>
          );
        };

  const renderRecord = (record: (typeof records)[number]) => {
          const key = `request:${record.reference}`;
          const pending = draft.pending(key);
          const status = pending?.change.wire.type === "request-status" ? pending.change.wire.status : record.status;
          const retiring = pending?.change.wire.type === "retire";
          const summary = summarise(record);

          let chipLabel: string;
          let chipTone: "quiet" | "marigold";
          if (record.paymentFailed) {
            chipLabel = t("paymentFailed");
            chipTone = "quiet";
          } else if (status !== "paid" && openPaymentLink(record)) {
            // Quiet, like every state still waiting on money: gold is kept for Pagado.
            chipLabel = to("chargeLinkOpen");
            chipTone = "quiet";
          } else if (record.awaitingPayment && status !== "paid") {
            chipLabel = t(record.awaitingPayment === "bank" ? "bankPending" : "awaitingPayment");
            chipTone = "quiet";
          } else {
            chipLabel = t(`status.${status}`);
            chipTone = status === "paid" ? "marigold" : "quiet";
          }

          return (
            <li key={record.reference} className={retiring ? "opacity-50" : ""}>
              <button type="button" onClick={() => setOpen(record.reference)} className={card}>
                {record.photoFile ? (
                  <span className="relative block h-24 w-full overflow-hidden bg-paper-warm">
                    <Image
                      src={photoHref(record)}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw"
                      className="object-cover"
                    />
                  </span>
                ) : null}
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
                    {t(`kind.${record.kind}`)}
                  </span>
                  <time className="shrink-0 text-[0.6875rem] text-ink-faint" dateTime={record.submittedAt}>
                    {formatDay(record.submittedAt, locale)}
                  </time>
                </span>
                <span className="truncate text-[0.9375rem]">{record.client.name || record.client.email}</span>
                {summary ? (
                  <span className="line-clamp-1 text-[0.8125rem] leading-relaxed text-ink-soft">{summary}</span>
                ) : null}
                <span className="mt-auto flex items-center justify-between gap-2">
                  {record.estimate ? (
                    <span className="text-[0.9375rem] tabular-nums">
                      {formatMoney(record.estimate.total, locale)}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Tag tone={chipTone}>{chipLabel}</Tag>
                </span>
              </button>
              {pending ? (
                <div className="mt-2">
                  <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                </div>
              ) : null}
            </li>
          );
        };

  const grid = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div className="flex flex-col gap-4">
      {showOrderNotes ? (
        <>
          {/* Where she starts one: one box above everything already in. The
              sheet asks which kind it is, so a box per kind only stacked
              three on a phone and pushed the work below the fold. */}
          <OrderNoteCard kind="order" paymentsEnabled={paymentsEnabled} clients={clients} />
          {/* What is already in, below, one group per kind so an alteration
              is never hunted for among the orders. */}
          {WORK_GROUPS.map((kind) => {
            const staged = pendingNotes.filter(
              (entry) => entry.change.wire.type === "order-note" && entry.change.wire.kind === kind,
            );
            const inGroup = records.filter((record) => record.kind === kind);
            if (staged.length === 0 && inGroup.length === 0) return null;
            return (
              <section key={kind} className="mt-6 flex flex-col gap-3">
                <h3 className="flex items-baseline gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink-faint">
                  {to(`workGroup.${kind}`)}
                  <span className="tabular-nums">{staged.length + inGroup.length}</span>
                </h3>
                <ul className={grid}>
                  {staged.map(renderPending)}
                  {inGroup.map(renderRecord)}
                </ul>
              </section>
            );
          })}
        </>
      ) : (
        <ul className={grid}>{records.map(renderRecord)}</ul>
      )}

      {empty ? <EmptyBox message={emptyMessage} /> : null}

      <Sheet
        open={open !== null}
        title={opened ? `${t(`kind.${opened.kind}`)} · ${opened.client.name || opened.client.email}` : ""}
        onClose={close}
      >
        {opened ? <RequestSheet record={opened} locale={locale} paymentsEnabled={paymentsEnabled} /> : null}
      </Sheet>
    </div>
  );
}

/**
 * One request, everything about it: the status, the photo or mockup when
 * there is one, a WhatsApp link when the client left a phone, the details
 * she'd otherwise have to open the record to read, and retire/undo.
 */
function RequestSheet({
  record,
  locale,
  paymentsEnabled,
}: {
  record: StoredRequest & { undoable: boolean };
  locale: Locale;
  paymentsEnabled: boolean;
}): JSX.Element {
  const t = useTranslations("account");
  const to = useTranslations("office");
  const draft = useOfficeDraft<WorkChange>();
  const key = `request:${record.reference}`;
  const pending = draft.pending(key);
  const status = pending?.change.wire.type === "request-status" ? pending.change.wire.status : record.status;
  const retiring = pending?.change.wire.type === "retire";

  function setStatus(next: StoredRequest["status"]) {
    if (next === record.status) {
      draft.unstage(key);
      return;
    }
    draft.stage(key, {
      wire: { type: "request-status", key, kind: record.kind, reference: record.reference, status: next },
    });
  }

  const phoneDigits = record.client.phone ? record.client.phone.replace(/[^0-9]/g, "") : "";
  const whatsappMessage =
    record.locale === "en"
      ? `Hi, about order ${record.reference}`
      : `Hola, sobre el pedido ${record.reference}`;

  return (
    <div className={`flex flex-col gap-6 ${retiring ? "opacity-50" : ""}`}>
      {pending ? (
        <span className="flex items-center gap-3">
          <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
          <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
            {to("removePending")}
          </button>
        </span>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.75rem]">{record.reference}</span>
        <time className="text-[0.75rem] text-ink-faint" dateTime={record.submittedAt}>
          {formatDay(record.submittedAt, locale)}
        </time>
      </div>

      <label className="grid gap-1 text-[0.75rem] text-ink-faint">
        {to("statusLabel")}
        <select
          value={status}
          disabled={retiring}
          onChange={(event) => setStatus(event.target.value as StoredRequest["status"])}
          className="border border-line bg-paper px-3 py-2 text-[0.9375rem] disabled:opacity-50"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {t(`status.${option}`)}
            </option>
          ))}
        </select>
      </label>
      {record.paymentFailed ? (
        <Tag tone="quiet">{t("paymentFailed")}</Tag>
      ) : record.awaitingPayment && status !== "paid" && !openPaymentLink(record) ? (
        <Tag tone="quiet">{t(record.awaitingPayment === "bank" ? "bankPending" : "awaitingPayment")}</Tag>
      ) : null}
      {record.estimate ? (
        <p className="text-[0.9375rem] tabular-nums text-ink-soft">{formatMoney(record.estimate.total, locale)}</p>
      ) : null}

      {paymentsEnabled && !pending && !retiring ? <ChargePanel record={record} locale={locale} /> : null}

      {/* The picture the client sent: a studio design's mockup, an
          alteration's snapshot. The office route serves it only to Daysi,
          and knows the request came from here by its Referer, so the link
          must never be marked noreferrer. */}
      {record.photoFile ? (
        <a href={photoHref(record)} target="_blank" className="block w-fit">
          <Image
            src={photoHref(record)}
            alt={to("requestPhoto", { reference: record.reference })}
            unoptimized
            width={216}
            height={288}
            className="h-72 w-[13.5rem] border border-line object-cover"
          />
        </a>
      ) : null}

      {phoneDigits.length >= 7 ? (
        <a
          href={whatsappLink(whatsappMessage, record.client.phone)}
          target="_blank"
          rel="noopener"
          className="link-underline w-fit text-[0.8125rem]"
        >
          {to("requestWhatsapp")}
        </a>
      ) : null}

      {detailLines(record).length > 0 ? (
        <div className="flex flex-col gap-1">
          {detailLines(record).map((line) => (
            <p key={line} className="text-[0.875rem] leading-relaxed text-ink-soft">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {!pending ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton
            name={record.reference}
            prompt={to("retireRequestConfirm", { name: record.reference })}
            onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: record.reference } })}
          />
          {record.undoable ? <UndoLink kind="request-status" id={record.reference} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Charging the client from the order itself: the amount (what the order
 * comes to, unless she types another), then one tap for a card payment page,
 * and from then on the ways to send it — WhatsApp when there is a phone,
 * email when there is an address, or the link itself to paste anywhere.
 * Made at once rather than staged: nothing moves until the client pays.
 */
function ChargePanel({ record, locale }: { record: StoredRequest; locale: Locale }): JSX.Element | null {
  const to = useTranslations("office");
  const router = useRouter();
  const link = openPaymentLink(record);
  const [amount, setAmount] = useState(() => inputOf(link?.amount ?? record.estimate?.total));
  const [remaking, setRemaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!link && !chargeable(record)) return null;

  async function postJson(url: string, body: unknown): Promise<Response> {
    try {
      return await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      return new Response(null, { status: 599 });
    }
  }

  async function makeLink() {
    setNote(null);
    const cents = centsFromInput(amount);
    if (cents === null || cents < 100 || cents > 500_000) return setNote(to("chargeBadAmount"));
    setBusy(true);
    try {
      const response = await postJson("/api/office/charge", { reference: record.reference, amount: cents });
      if (!response.ok) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        return setNote(to(error === "old-link-open" ? "chargeOldOpen" : "chargeFailed"));
      }
      setRemaking(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setNote(null);
    setBusy(true);
    try {
      const response = await postJson("/api/office/charge/email", { reference: record.reference });
      setNote(to(response.ok ? "chargeEmailed" : "chargeEmailFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNote(to("chargeCopied"));
    } catch {
      setNote(url);
    }
  }

  const phoneDigits = record.client.phone ? record.client.phone.replace(/[^0-9]/g, "") : "";

  return (
    <section className="flex flex-col gap-4 border border-line bg-paper-warm/60 p-4">
      <h3 className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink-faint">{to("chargeTitle")}</h3>

      {link && !remaking ? (
        <>
          <p className="text-[0.9375rem] leading-relaxed">
            {to("chargeReady", { amount: formatMoney(link.amount, locale), until: formatUntil(link.expiresAt, locale) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {phoneDigits.length >= 7 ? (
              <a
                href={whatsappLink(
                  record.locale === "en"
                    ? `Hi, here is the link to pay ${formatMoney(link.amount, "en")} for ${record.reference}: ${link.url}`
                    : `Hola, aquí está el enlace para pagar ${formatMoney(link.amount, "es")} de ${record.reference}: ${link.url}`,
                  record.client.phone,
                )}
                target="_blank"
                rel="noopener"
                className={buttonClass({ size: "small", tone: "solid" })}
              >
                {to("chargeWhatsapp")}
              </a>
            ) : null}
            {record.client.email ? (
              <button
                type="button"
                disabled={busy}
                onClick={sendEmail}
                className={buttonClass({ size: "small", tone: phoneDigits.length >= 7 ? "outline" : "solid" })}
              >
                {to("chargeEmail")}
              </button>
            ) : null}
            <button type="button" onClick={() => copy(link.url)} className={buttonClass({ size: "small", tone: "outline" })}>
              {to("chargeCopy")}
            </button>
          </div>
          <button type="button" onClick={() => setRemaking(true)} className="w-fit text-xs underline underline-offset-4">
            {to("chargeRemake")}
          </button>
        </>
      ) : (
        <>
          <MoneyBox label={to("chargeAmount")} value={amount} onChange={setAmount} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={makeLink}
              className={buttonClass({ size: "small", tone: "solid" })}
            >
              {busy ? to("chargeMaking") : to("chargeMake")}
            </button>
            {remaking ? (
              <button type="button" onClick={() => setRemaking(false)} className="text-xs underline underline-offset-4">
                {to("chargeKeepOld")}
              </button>
            ) : null}
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{to("chargeHint")}</p>
        </>
      )}

      {note ? (
        <p role="status" className="text-[0.8125rem] text-ink">
          {note}
        </p>
      ) : null}
    </section>
  );
}

/** Cents as she would type them: 4500 is "45", 4550 is "45.50". */
function inputOf(cents: number | undefined): string {
  if (!cents) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function formatUntil(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

function photoHref(record: StoredRequest): string {
  return `/api/office/photos/${encodeURIComponent(record.reference)}`;
}

function formatDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Every non-empty detail, in the order the record carries them. */
function detailLines(record: StoredRequest): string[] {
  return Object.values(record.details)
    .map((value) => (Array.isArray(value) ? value.join(", ") : String(value)))
    .filter((value) => value.length > 0 && value !== "false");
}

/** The one line of detail worth showing without opening the sheet. */
function summarise(record: StoredRequest): string {
  return detailLines(record).slice(0, 2).join(" · ");
}

/** "Nothing here yet", drawn the same way in every list of the Hub. */
function EmptyBox({ message }: { message: string }): JSX.Element {
  return (
    <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
      {message}
    </p>
  );
}
