"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { MEASUREMENTS, type MeasurementId } from "@/content/measurements";
import type { Locale } from "@/i18n/routing";
import { bothUnits, defaultUnit, type Unit } from "@/lib/measurements";
import { formatMoney } from "@/lib/money";
import type { ClientChange } from "@/lib/office-validation";
import { whatsappLink } from "@/lib/whatsapp";
import { ChoiceGroup } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { EMPTY_ADDRESS, HOME_STATE, shownText, type AddressFields } from "../client-card-draft";
import {
  archiveKey,
  cardKey,
  leaveBox,
  newClientKey,
  revealOnDone,
  sheetProblems,
  shortDate,
  stagedChange,
  startingForm,
  visibleProblems,
  type ClientSheetForm,
  type OfficeBookRow,
  type SheetMeta,
} from "./client-draft";
import { MeasureRow, PendingLine, QuietButton, Section, TextField, field } from "./client-sheet-parts";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

/**
 * One client's card, as Daysi keeps it: contact, address, the measurements,
 * what the client wrote, her own note, their orders, and Archivar.
 *
 * Every edit stages at once, as one `client-save` built by `stagedChange`
 * (only what changed; nothing the server would refuse), so Listo, Escape,
 * the backdrop and the back gesture all just close. The boxes for the
 * measurements start empty beside what is on file: she types only the one
 * she retook, so a number she never touched keeps its owner and its date.
 *
 * The sheet holds what she typed itself (a half-typed number stages
 * nothing, and must not vanish), and keeps it beside the staged change so
 * reopening shows it again. A box is marked only once she has left it, and
 * every box still wrong is marked the first time she taps Listo, which
 * then waits for a second tap: what is marked stays out of the draft. When the change leaves the draft without the
 * sheet asking (Descartar, or a confirm that went through) it starts again
 * from the card on file, or closes when there is no card to go back to.
 */

const isNewKey = (key: string) => key.startsWith("client:new-");

/** The unit the card already speaks, or the language's. */
function unitFor(row: OfficeBookRow, locale: Locale): Unit {
  const kept = MEASUREMENTS.map((m) => row.card?.measurements[m.id]).find((m) => m !== undefined);
  return kept?.unit ?? defaultUnit(locale);
}

export function ClientSheet({
  row,
  staged,
  undoable,
  locale,
  onClose,
  doneGuard,
}: {
  row: OfficeBookRow;
  /** What this sheet staged last time it was open, if it is still in the draft. */
  staged?: SheetMeta;
  undoable: boolean;
  locale: Locale;
  onClose(): void;
  /** Set by the sheet for the view's Listo: false means "stay open, there is something to see". */
  doneGuard: { current: (() => boolean) | null };
}): JSX.Element {
  const t = useTranslations("office");
  const tc = useTranslations("clientCard");
  const te = useTranslations("errors");
  const tk = useTranslations("account");
  const draft = useOfficeDraft<ClientChange>();
  const [form, setForm] = useState<ClientSheetForm>(
    () =>
      staged?.form ??
      startingForm(row, unitFor(row, locale), row.cardId ? undefined : isNewKey(row.key) ? row.key : newClientKey()),
  );
  const key = row.cardId ? cardKey(row.cardId) : (form.key ?? row.key);
  const entry = draft.pending(key);
  const archiving = row.cardId ? draft.pending(archiveKey(row.cardId)) : undefined;
  const problems = sheetProblems(form);
  // Reopened with something still wrong in it: she has already left those boxes.
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set(staged ? sheetProblems(staged.form) : []));
  const [warned, setWarned] = useState(false);
  const visible = visibleProblems(problems, shown);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    doneGuard.current = () => {
      const next = revealOnDone(form, shown, warned);
      if (!next) return true;
      setShown(next);
      setWarned(true);
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return false;
    };
    return () => {
      doneGuard.current = null;
    };
  });

  /** She left a box: its problem, if any, may show now (an empty one waits for Listo; see `leaveBox`). */
  function leave(field: string) {
    setShown((current) => leaveBox(current, field, form, isNewKey(row.key)));
  }

  /** She is typing in a box again: say nothing about it until she leaves it. */
  function editing(field: string) {
    setShown((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  }

  const unstagedHere = useRef(false);
  const hadEntry = useRef(entry !== undefined);
  const hasEntry = entry !== undefined;
  useEffect(() => {
    if (hadEntry.current && !hasEntry && !unstagedHere.current) {
      if (row.cardId) {
        setForm(startingForm(row, form.unit));
        setShown(new Set());
        setWarned(false);
      } else {
        onClose();
      }
    }
    unstagedHere.current = false;
    hadEntry.current = hasEntry;
  }, [hasEntry, row, form.unit, onClose]);

  function update(patch: Partial<ClientSheetForm>) {
    const next = { ...form, ...patch };
    setForm(next);
    const wire = stagedChange(row, next);
    if (wire) {
      draft.stage(wire.key, { wire, meta: { rowKey: row.key, form: next } satisfies SheetMeta });
    } else if (entry?.change.wire.type === "client-save") {
      unstagedHere.current = true;
      draft.unstage(key);
    }
  }

  function setAddress(part: keyof AddressFields, value: string) {
    editing("address");
    if (form.address) update({ address: { ...form.address, [part]: value } });
  }

  function typeValue(id: MeasurementId, text: string) {
    editing(id);
    const removed = new Set(form.removed);
    removed.delete(id);
    update({ values: { ...form.values, [id]: text }, units: { ...form.units, [id]: form.unit }, removed });
  }

  function setRemoved(id: MeasurementId, gone: boolean) {
    const removed = new Set(form.removed);
    if (gone) removed.add(id);
    else removed.delete(id);
    const { [id]: _typed, ...values } = form.values;
    update({ removed, values: gone ? values : form.values });
  }

  // Which of the address boxes to mark once the address is shown as wrong: the same rules the schema holds it to.
  const address = form.address;
  const addressMarks =
    visible.has("address") && address
      ? {
          line1: address.line1.trim().length < 3,
          city: address.city.trim().length < 2,
          state: address.state.trim().length < 2,
          zip: !/^\d{5}(-\d{4})?$/.test(address.zip.trim()),
        }
      : { line1: false, city: false, state: false, zip: false };

  const phone = form.phone.trim();
  const reachable = phone.replace(/\D/g, "").length >= 7 && !problems.includes("phone");
  const firstName = form.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div ref={root} className="flex flex-col divide-y divide-line">
      {entry || archiving ? (
        <div className="flex flex-col gap-2 pb-5">
          {entry ? <PendingLine entry={entry} onDrop={() => draft.unstage(key)} /> : null}
          {archiving && row.cardId ? (
            <PendingLine
              entry={archiving}
              label={
                archiving.change.wire.type === "client-archive" && archiving.change.wire.archived
                  ? t("clientArchivePending")
                  : undefined
              }
              onDrop={() => draft.unstage(archiveKey(row.cardId!))}
            />
          ) : null}
        </div>
      ) : null}

      <Section title={t("clientContact")} aside={row.hasAccount ? t("clientHasAccount") : undefined}>
        <TextField
          label={tc("name")}
          value={form.name}
          maxLength={80}
          autoComplete="off"
          error={visible.has("name") ? te("too-short") : undefined}
          onBlur={() => leave("name")}
          onChange={(event) => {
            editing("name");
            update({ name: event.target.value });
          }}
        />
        {row.hasAccount ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[0.8125rem] text-ink-faint">{tc("email")}</p>
            <p className="break-all bg-paper-warm px-3 py-3 text-[1rem] text-ink-soft">{form.email}</p>
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("clientEmailLocked")}</p>
          </div>
        ) : (
          <TextField
            label={tc("email")}
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={160}
            value={form.email}
            error={visible.has("email") ? te("invalid-email") : undefined}
            onBlur={() => leave("email")}
            onChange={(event) => {
              editing("email");
              update({ email: event.target.value });
            }}
          />
        )}
        <TextField
          label={tc("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={30}
          value={form.phone}
          error={visible.has("phone") ? te("invalid-phone") : undefined}
          onBlur={() => leave("phone")}
          onChange={(event) => {
            editing("phone");
            update({ phone: event.target.value });
          }}
        />
        {reachable ? (
          <a
            href={whatsappLink(firstName ? t("clientWhatsappHello", { name: firstName }) : "", phone)}
            target="_blank"
            rel="noopener"
            className="link-underline w-fit text-[0.8125rem]"
          >
            {t("requestWhatsapp")}
          </a>
        ) : null}
      </Section>

      <Section title={t("clientAddress")}>
        {form.address ? (
          <div
            className="flex flex-col gap-4"
            // The address is one answer in five boxes: it is left when focus leaves all of them.
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leave("address");
            }}
          >
            <TextField
              label={tc("line1")}
              value={form.address.line1}
              maxLength={120}
              autoComplete="off"
              invalid={addressMarks.line1}
              onChange={(event) => setAddress("line1", event.target.value)}
            />
            <TextField
              label={tc("line2")}
              value={form.address.line2}
              maxLength={60}
              autoComplete="off"
              onChange={(event) => setAddress("line2", event.target.value)}
            />
            <TextField
              label={tc("city")}
              value={form.address.city}
              maxLength={60}
              autoComplete="off"
              invalid={addressMarks.city}
              onChange={(event) => setAddress("city", event.target.value)}
            />
            <div className="grid grid-cols-[2fr_3fr] gap-4">
              <TextField
                label={tc("state")}
                value={form.address.state}
                maxLength={30}
                autoComplete="off"
                invalid={addressMarks.state}
                onChange={(event) => setAddress("state", event.target.value)}
              />
              <TextField
                label={tc("zip")}
                value={form.address.zip}
                maxLength={10}
                inputMode="numeric"
                autoComplete="off"
                invalid={addressMarks.zip}
                onChange={(event) => setAddress("zip", event.target.value)}
              />
            </div>
            {visible.has("address") ? (
              <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("clientAddressProblem")}</p>
            ) : null}
            <QuietButton onClick={() => update({ address: null })}>{tc("removeAddress")}</QuietButton>
          </div>
        ) : (
          <QuietButton onClick={() => update({ address: { ...EMPTY_ADDRESS, state: HOME_STATE } })}>
            {tc("addAddress")}
          </QuietButton>
        )}
      </Section>

      <Section title={t("clientMeasures")}>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("clientMeasuresHint")}</p>
        <ChoiceGroup
          legend={tc("unitLegend")}
          value={form.unit}
          // Only what the boxes show changes: each keeps what was typed, in its own unit.
          onChange={(unit) => update({ unit })}
          options={[
            { value: "in", label: tc("unitIn") },
            { value: "cm", label: tc("unitCm") },
          ]}
        />
        <ul className="divide-y divide-line border-y border-line">
          {MEASUREMENTS.map((measurement) => {
            const id = measurement.id;
            const kept = row.card?.measurements[id];
            const typed = form.values[id] ?? "";
            return (
              <MeasureRow
                key={id}
                label={measurement.label[locale]}
                unit={form.unit}
                unitName={form.unit === "in" ? tc("unitIn") : tc("unitCm")}
                onFile={
                  kept
                    ? `${bothUnits(kept.value, kept.unit)} · ${t(kept.by === "daysi" ? "clientYours" : "clientTheirs", { date: shortDate(kept.at, locale) })}`
                    : t("clientNotTaken")
                }
                text={shownText({ text: typed, unit: form.units?.[id] ?? form.unit }, form.unit)}
                removed={form.removed.has(id)}
                removable={kept !== undefined}
                problem={t("clientValueProblem")}
                invalid={visible.has(id)}
                onType={(text) => typeValue(id, text)}
                onBlur={() => leave(id)}
                onRemove={(gone) => setRemoved(id, gone)}
              />
            );
          })}
        </ul>
      </Section>

      {row.card?.notes ? (
        <Section title={t("clientNotes")}>
          <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-soft">{row.card.notes}</p>
        </Section>
      ) : null}

      <Section title={t("clientOwnerNote")} aside={t("clientOwnerNoteHint")}>
        <textarea
          aria-label={t("clientOwnerNote")}
          value={form.ownerNote}
          maxLength={400}
          rows={3}
          onChange={(event) => update({ ownerNote: event.target.value })}
          className={`${field} resize-y leading-relaxed`}
        />
      </Section>

      {row.cardId || row.orders.length > 0 ? (
        <Section
          title={t("clientOrdersTitle")}
          aside={row.paidTotal > 0 ? t("clientPaidTotal", { amount: formatMoney(row.paidTotal, locale) }) : undefined}
        >
          {row.orders.length === 0 ? (
            <p className="text-[0.875rem] text-ink-faint">{t("clientNoOrders")}</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {row.orders.map((order) => (
                <li key={order.reference} className="flex min-h-14 items-center justify-between gap-4 py-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[0.9375rem] text-ink">{tk(`kind.${order.kind}`)}</span>
                    <span className="truncate text-[0.8125rem] text-ink-faint">
                      {[shortDate(order.submittedAt, locale), tk(`status.${order.status}`), order.reference].join(" · ")}
                    </span>
                  </span>
                  {order.total > 0 ? (
                    <span className="shrink-0 text-[0.9375rem] tabular-nums text-ink">{formatMoney(order.total, locale)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {row.cardId ? (
        <section className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-5">
            {archiving ? null : (
              <button
                type="button"
                onClick={() => {
                  const id = row.cardId!;
                  const archive = archiveKey(id);
                  draft.stage(archive, { wire: { type: "client-archive", key: archive, id, archived: !row.archived } });
                }}
                className={buttonClass({ tone: "outline", size: "small" })}
              >
                {row.archived ? t("clientRestore") : t("clientArchive")}
              </button>
            )}
            {undoable && !entry ? <UndoLink kind="client-card" id={row.cardId} /> : null}
          </div>
          {row.archived ? null : (
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("clientArchiveHint")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
