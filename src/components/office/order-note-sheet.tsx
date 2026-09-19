"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import { shopDay } from "@/content";
import { centsFromInput } from "@/lib/money";
import { normalizePhone, type WorkChange } from "@/lib/office-validation";
import { buttonClass } from "@/components/ui";
import { ChoiceGroup } from "@/components/form";
import { matchClients, type PickerEntry } from "./client-match";
import { MoneyBox } from "./garment-sheet";
import { Sheet } from "./sheet";
import { useOfficeDraft } from "./use-office-draft";

export { matchClients, type PickerEntry };

const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";
/** The most any price in the office may be, as everywhere else she types one. */
const MAX_CENTS = 500_000;
export const NOTED_KINDS = ["order", "alteration", "commission"] as const;
const KINDS = NOTED_KINDS;
export type NotedKind = (typeof KINDS)[number];
/** Money already in, a card link to send now, or owed for later. */
type Payment = "paid" | "charge" | "later";

/**
 * The "+" that opens the sheet for an order Daysi took off-site — in person
 * or over WhatsApp — so it still lands in the Hub, her figures and her
 * books. Only the Trabajo section offers it: a session or a message always
 * comes from the site itself.
 */
export function OrderNoteCard({
  kind,
  paymentsEnabled,
  clients = [],
}: {
  /** Which kind this box starts as; she can still change it in the sheet. */
  kind: NotedKind;
  paymentsEnabled: boolean;
  /** The book, for the client-name box to offer as she types. */
  clients?: readonly PickerEntry[];
}): JSX.Element {
  const t = useTranslations("office");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-3 border border-dashed border-line-strong px-5 py-3 text-center text-[0.8125rem] text-ink-soft transition-colors hover:border-ink hover:text-ink sm:min-h-24 sm:flex-col sm:gap-2"
      >
        <span className="text-xl leading-none sm:text-2xl">+</span>
        {t("addNoteAny")}
      </button>
      <Sheet open={open} title={t("addNoteAny")} onClose={close}>
        <OrderNoteForm onDone={close} initialKind={kind} paymentsEnabled={paymentsEnabled} clients={clients} />
      </Sheet>
    </>
  );
}

/**
 * What she fills in: what it is, who it is for, what it comes to and
 * whether she already has the money. Agregar a los cambios stages one
 * order-note; the action gives it a reference and writes it as her own line
 * once she confirms. Nothing is mailed for it: not a receipt to the client,
 * not a notice to Daysi — she is the one writing it down.
 */
function OrderNoteForm({
  onDone,
  initialKind,
  paymentsEnabled,
  clients,
}: {
  onDone(): void;
  initialKind: NotedKind;
  paymentsEnabled: boolean;
  clients: readonly PickerEntry[];
}): JSX.Element {
  const t = useTranslations("office");
  const k = useTranslations("account");
  const draft = useOfficeDraft<WorkChange>();
  const [kind, setKind] = useState<NotedKind>(initialKind);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<Payment>("paid");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const today = shopDay(new Date());

  // The "Nombre del cliente" box doubles as a combobox onto the book: from
  // two typed characters, up to five matches sit under the field. Closing is
  // deferred a beat on blur so a tap on an option has time to land before it
  // is unmounted from under the pointer.
  const listId = useId();
  const [listOpen, setListOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matches = matchClients(clients, clientName);
  const listExpanded = listOpen && matches.length > 0;

  const pickClient = useCallback((entry: PickerEntry) => {
    setClientName(entry.name);
    setPhone(entry.phone);
    setEmail(entry.email);
    setListOpen(false);
  }, []);

  const closeListSoon = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setListOpen(false), 150);
  }, []);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    if (clientName.trim().length < 2) return setProblem(t("orderNoteNameRequired"));
    const cents = centsFromInput(amount);
    if (cents === null || cents > MAX_CENTS) return setProblem(t("servicePriceRequired"));
    // Cleaned the same way the schema cleans it, so a number that reads fine
    // to her — pasted from WhatsApp, a stray direction mark and all — is
    // never staged only to be refused when she confirms.
    const cleanPhone = normalizePhone(phone).trim();
    if (phone.trim() && (cleanPhone.length < 7 || cleanPhone.length > 30)) {
      return setProblem(t("orderNotePhoneInvalid"));
    }

    const key = `order-note:${crypto.randomUUID()}`;
    draft.stage(key, {
      wire: {
        type: "order-note",
        key,
        kind,
        clientName: clientName.trim(),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        description: description.trim(),
        amount: cents,
        paid: payment === "paid",
        ...(payment === "charge" ? { charge: true } : {}),
        ...(date ? { date } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("orderNoteLead")}</p>

      <section className="flex flex-col gap-4">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("orderNoteKindLabel")}
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as NotedKind)}
            className={`${field} min-h-11`}
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {k(`kind.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="relative grid gap-1 text-[0.75rem] text-ink-faint">
          {t("orderNoteClientName")}
          <input
            role="combobox"
            aria-expanded={listExpanded}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={clientName}
            onChange={(event) => {
              setClientName(event.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            onBlur={closeListSoon}
            onKeyDown={(event) => {
              if (event.key === "Escape") setListOpen(false);
            }}
            minLength={2}
            maxLength={80}
            required
            className={field}
          />
          {listExpanded ? (
            <div
              id={listId}
              role="listbox"
              aria-label={t("orderNoteClientName")}
              className="absolute inset-x-0 top-full z-10 mt-1 divide-y divide-line border border-line bg-paper text-ink shadow-[0_18px_40px_-24px_rgba(20,17,13,0.5)]"
            >
              {matches.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pickClient(entry)}
                  className="flex min-h-11 w-full flex-col justify-center gap-0.5 px-3 py-2 text-left transition-colors hover:bg-paper-warm"
                >
                  <span className="truncate text-[0.9375rem] text-ink">{entry.name}</span>
                  {entry.phone || entry.email ? (
                    <span className="truncate text-[0.8125rem] text-ink-faint">{entry.phone || entry.email}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("orderNotePhone")}
            <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} className={field} />
          </label>
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("orderNoteEmail")}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={160}
              className={field}
            />
          </label>
        </div>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("orderNoteDescription")}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={400}
            rows={2}
            className={`${field} resize-none`}
          />
        </label>
        <ChoiceGroup<Payment>
          legend={t("orderNotePayment")}
          options={[
            { value: "paid", label: t("orderNotePaidNow") },
            ...(paymentsEnabled ? [{ value: "charge" as Payment, label: t("orderNoteCharge") }] : []),
            { value: "later", label: t("orderNoteLater") },
          ]}
          value={payment}
          onChange={setPayment}
        />
        <MoneyBox
          label={t(payment === "paid" ? "orderNoteAmount" : payment === "charge" ? "orderNoteChargeAmount" : "orderNoteOwedAmount")}
          value={amount}
          onChange={setAmount}
        />
        {payment === "charge" ? (
          <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("orderNoteChargeHint")}</p>
        ) : null}
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("orderNoteDate")}
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            min="2020-01-01"
            max={today}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("orderNoteNotes")}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={400}
            rows={2}
            className={`${field} resize-none`}
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("serviceSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}
