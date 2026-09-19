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
  newClientKey,
  sheetProblems,
  shortDate,
  stagedChange,
  startingForm,
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
 * reopening shows it again. When the change leaves the draft without the
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
}: {
  row: OfficeBookRow;
  /** What this sheet staged last time it was open, if it is still in the draft. */
  staged?: SheetMeta;
  undoable: boolean;
  locale: Locale;
  onClose(): void;
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
  const problems = new Set(sheetProblems(form));

  const unstagedHere = useRef(false);
  const hadEntry = useRef(entry !== undefined);
  const hasEntry = entry !== undefined;
  useEffect(() => {
    if (hadEntry.current && !hasEntry && !unstagedHere.current) {
      if (row.cardId) setForm(startingForm(row, form.unit));
      else onClose();
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
    if (form.address) update({ address: { ...form.address, [part]: value } });
  }

  function typeValue(id: MeasurementId, text: string) {
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

  const phone = form.phone.trim();
  const reachable = phone.replace(/\D/g, "").length >= 7 && !problems.has("phone");
  const firstName = form.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="flex flex-col divide-y divide-line">
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
          error={problems.has("name") && (form.name.length > 0 || !isNewKey(row.key)) ? te("too-short") : undefined}
          onChange={(event) => update({ name: event.target.value })}
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
            error={problems.has("email") ? te("invalid-email") : undefined}
            onChange={(event) => update({ email: event.target.value })}
          />
        )}
        <TextField
          label={tc("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={30}
          value={form.phone}
          error={problems.has("phone") ? te("invalid-phone") : undefined}
          onChange={(event) => update({ phone: event.target.value })}
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
          <>
            <TextField
              label={tc("line1")}
              value={form.address.line1}
              maxLength={120}
              autoComplete="off"
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
              onChange={(event) => setAddress("city", event.target.value)}
            />
            <div className="grid grid-cols-[2fr_3fr] gap-4">
              <TextField
                label={tc("state")}
                value={form.address.state}
                maxLength={30}
                autoComplete="off"
                onChange={(event) => setAddress("state", event.target.value)}
              />
              <TextField
                label={tc("zip")}
                value={form.address.zip}
                maxLength={10}
                inputMode="numeric"
                autoComplete="off"
                onChange={(event) => setAddress("zip", event.target.value)}
              />
            </div>
            {problems.has("address") ? (
              <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("clientAddressProblem")}</p>
            ) : null}
            <QuietButton onClick={() => update({ address: null })}>{tc("removeAddress")}</QuietButton>
          </>
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
                error={problems.has(id) ? tc("errorRange") : undefined}
                onType={(text) => typeValue(id, text)}
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
