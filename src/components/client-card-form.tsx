"use client";

import { useId, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MEASUREMENTS, type MeasurementId } from "@/content/measurements";
import { useRouter, type Locale } from "@/i18n/routing";
// Types only: client-cards.ts reads the store and must never reach the browser.
import type {
  Address,
  ClientCardInput,
  MeasurementInput,
  Measurements,
  PreferredContact,
} from "@/lib/client-cards";
import { bothUnits, defaultUnit, toCm, withinRange, type Unit } from "@/lib/measurements";
import { ChoiceGroup, Field, TextArea, TextInput } from "./form";
import { InfoTip } from "./info-tip";
import { buttonClass } from "./ui";

/**
 * The client's own card, from their account: contact, an optional address,
 * the measurements and a note for Daysi, filled in whenever they can.
 *
 * The page hands over only what this form shows (never Daysi's private note
 * or the card's ids). A measurement Daysi took is shown as text and never
 * sent: the server keeps hers whatever arrives. Every other measurement the
 * client still has is sent on every save, because the save replaces the
 * client's numbers with exactly what it receives, so one left out is one
 * the client emptied.
 */

type AddressFields = {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
};

export type CardFormState = {
  readonly name: string;
  readonly phone: string;
  readonly preferredContact: PreferredContact | null;
  readonly addressOpen: boolean;
  readonly address: AddressFields;
  readonly notes: string;
  readonly unit: Unit;
  /** What is in each box, as typed. */
  readonly values: Readonly<Record<MeasurementId, string>>;
  /** Daysi's: shown, never sent. */
  readonly locked: ReadonlySet<MeasurementId>;
};

/** What the page passes in: the viewer's own card, and nothing else of it. */
export type CardFormInitial = {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly preferredContact: PreferredContact | null;
  readonly address: Address | null;
  readonly notes: string;
  readonly measurements: Measurements;
};

const EMPTY_ADDRESS: AddressFields = { line1: "", line2: "", city: "", state: "", zip: "" };
const CM_PER_INCH = toCm(1, "in");
/** The Bronx is in New York, and so is nearly every client. */
const HOME_STATE = "NY";

/** "30,5" and "30.5" are one number: a phone set to Spanish offers the comma. */
function readNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  return /^(\d+(\.\d*)?|\.\d+)$/.test(cleaned) ? Number(cleaned) : null;
}

/** Half an inch or a whole centimetre: as fine as a tape is read. */
function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  const cm = toCm(value, from);
  return to === "cm" ? Math.round(cm) : Math.round((cm / CM_PER_INCH) * 2) / 2;
}

/** Every number the client typed, in the other unit. Daysi's and unreadable ones stay as they are. */
export function switchUnit(
  values: Readonly<Record<MeasurementId, string>>,
  locked: ReadonlySet<MeasurementId>,
  from: Unit,
  to: Unit,
): Record<MeasurementId, string> {
  const next = { ...values };
  if (from === to) return next;
  for (const { id } of MEASUREMENTS) {
    const value = readNumber(values[id]);
    if (locked.has(id) || value === null) continue;
    next[id] = String(convert(value, from, to));
  }
  return next;
}

/** What a save sends: trimmed, with empty fields left out and Daysi's numbers never included. */
export function formPayload(state: CardFormState): ClientCardInput {
  const phone = state.phone.trim();
  const notes = state.notes.trim();
  // WhatsApp and a call both need a number; without one, only email is a choice.
  const preferredContact =
    state.preferredContact && (phone || state.preferredContact === "email") ? state.preferredContact : null;

  const line1 = state.address.line1.trim();
  const line2 = state.address.line2.trim();
  const city = state.address.city.trim();
  const region = state.address.state.trim();
  const zip = state.address.zip.trim();
  // The state starts filled in, so it alone does not make an address.
  const hasAddress = state.addressOpen && Boolean(line1 || line2 || city || zip);

  const measurements: Partial<Record<MeasurementId, MeasurementInput>> = {};
  for (const { id } of MEASUREMENTS) {
    const text = state.values[id].trim();
    if (state.locked.has(id) || !text) continue;
    // A number it cannot read goes as NaN (null on the wire), which the
    // server refuses: dropping it would erase the one on file.
    measurements[id] = { value: readNumber(text) ?? Number.NaN, unit: state.unit };
  }

  return {
    name: state.name.trim(),
    ...(phone ? { phone } : {}),
    ...(preferredContact ? { preferredContact } : {}),
    ...(hasAddress ? { address: { line1, ...(line2 ? { line2 } : {}), city, state: region, zip } } : {}),
    ...(notes ? { notes } : {}),
    measurements,
  };
}

function startingState(initial: CardFormInitial, locale: Locale): CardFormState {
  const locked = new Set(MEASUREMENTS.filter((m) => initial.measurements[m.id]?.by === "daysi").map((m) => m.id));
  const kept = MEASUREMENTS.map((m) => initial.measurements[m.id]).filter((m) => m !== undefined);
  // The unit their tape speaks: their own numbers first, then Daysi's, then the language's.
  const unit = (kept.find((m) => m.by === "client") ?? kept[0])?.unit ?? defaultUnit(locale);

  const values = Object.fromEntries(
    MEASUREMENTS.map(({ id }) => {
      const measurement = initial.measurements[id];
      if (!measurement || locked.has(id)) return [id, ""];
      return [id, String(convert(measurement.value, measurement.unit, unit))];
    }),
  ) as Record<MeasurementId, string>;

  return {
    name: initial.name,
    phone: initial.phone,
    preferredContact: initial.preferredContact,
    addressOpen: initial.address !== null,
    address: initial.address
      ? { ...initial.address, line2: initial.address.line2 ?? "" }
      : EMPTY_ADDRESS,
    notes: initial.notes,
    unit,
    values,
    locked,
  };
}

/** Whether "Borrar lo que escribí" has anything to clear. */
function hasOwnEntries(payload: ClientCardInput): boolean {
  return Boolean(payload.address || payload.notes || Object.keys(payload.measurements).length > 0);
}

type Status =
  | { readonly kind: "idle" | "saving" | "clearing" | "saved" | "cleared" }
  | { readonly kind: "error"; readonly message: string };

const inputClass = "text-[1rem]";

export function ClientCardForm({ initial, locale }: { initial: CardFormInitial; locale: Locale }) {
  const t = useTranslations("clientCard");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<CardFormState>(() => startingState(initial, locale));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [hasOwn, setHasOwn] = useState(() => hasOwnEntries(formPayload(form)));
  const busy = status.kind === "saving" || status.kind === "clearing";

  /** Any edit takes back "Guardado." and the error on the field it touched. */
  function update(patch: Partial<CardFormState>, field?: string) {
    setForm((current) => ({ ...current, ...patch }));
    if (field && errors[field]) dropErrors(field);
    if (status.kind === "saved" || status.kind === "cleared") setStatus({ kind: "idle" });
  }

  function dropErrors(prefix: string) {
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(prefix))));
  }

  function setAddress(key: keyof AddressFields, value: string) {
    update({ address: { ...form.address, [key]: value } }, `address.${key}`);
  }

  function setValue(id: MeasurementId, value: string) {
    update({ values: { ...form.values, [id]: value } }, `measurements.${id}`);
  }

  function showErrors(found: Record<string, string>) {
    setErrors(found);
    setStatus({ kind: "error", message: t("errorCheck") });
    // On a phone the marked field is usually off screen: take them to it.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  /** The route names fields by path ("measurements.waist", "address.zip"); each gets its line. */
  function messagesFor(fields: readonly string[]): Record<string, string> {
    const found: Record<string, string> = {};
    for (const field of fields) {
      if (field === "name") found[field] = te("too-short");
      else if (field === "phone") found[field] = te("invalid-phone");
      else if (field === "address.zip") found[field] = t("errorZip");
      else if (field.startsWith("address.")) {
        const key = field.slice("address.".length) as keyof AddressFields;
        found[field] = form.address[key]?.trim() ? te("too-short") : te("required");
      } else if (field.startsWith("measurements.")) found[field] = t("errorRange");
    }
    return found;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    // Checked here first, so a typo costs no trip and no save from the hour's allowance.
    const local: Record<string, string> = {};
    for (const { id } of MEASUREMENTS) {
      const text = form.values[id].trim();
      if (form.locked.has(id) || !text) continue;
      const value = readNumber(text);
      if (value === null || !withinRange(id, value, form.unit)) local[`measurements.${id}`] = t("errorRange");
    }
    if (Object.keys(local).length > 0) {
      showErrors(local);
      return;
    }

    const payload = formPayload(form);
    setErrors({});
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/account/details", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }
      if (response.status === 429) {
        setStatus({ kind: "error", message: te("rateLimited") });
        return;
      }
      if (response.status === 400) {
        const body = (await response.json().catch(() => null)) as { fields?: string[] } | null;
        const found = messagesFor(body?.fields ?? []);
        if (Object.keys(found).length > 0) showErrors(found);
        else setStatus({ kind: "error", message: t("errorGeneric") });
        return;
      }
      if (!response.ok) {
        setStatus({ kind: "error", message: t("errorGeneric") });
        return;
      }
      setHasOwn(hasOwnEntries(payload));
      setStatus({ kind: "saved" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: t("errorGeneric") });
    }
  }

  async function clear() {
    if (busy || !window.confirm(t("clearConfirm"))) return;
    setStatus({ kind: "clearing" });
    try {
      const response = await fetch("/api/account/details", { method: "DELETE" });
      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }
      if (response.status === 429) {
        setStatus({ kind: "error", message: te("rateLimited") });
        return;
      }
      if (!response.ok) {
        setStatus({ kind: "error", message: t("errorGeneric") });
        return;
      }
      // What the server just did: the name, the phone and Daysi's numbers stay.
      setForm((current) => ({
        ...current,
        addressOpen: false,
        address: EMPTY_ADDRESS,
        notes: "",
        values: Object.fromEntries(
          MEASUREMENTS.map(({ id }) => [id, current.locked.has(id) ? current.values[id] : ""]),
        ) as Record<MeasurementId, string>,
      }));
      setErrors({});
      setHasOwn(false);
      setStatus({ kind: "cleared" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: t("errorGeneric") });
    }
  }

  /** One address box. Called, not rendered as a component, so typing never remounts it. */
  function addressField(
    key: keyof AddressFields,
    props: InputHTMLAttributes<HTMLInputElement>,
    optional = false,
  ) {
    const path = `address.${key}`;
    return (
      <Field label={t(key)} optional={optional} error={errors[path]}>
        {({ id, describedBy }) => (
          <TextInput
            {...props}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={errors[path] ? true : undefined}
            value={form.address[key]}
            onChange={(event) => setAddress(key, event.target.value)}
            className={`${inputClass} ${props.className ?? ""}`}
          />
        )}
      </Field>
    );
  }

  const statusLine =
    status.kind === "saving"
      ? t("saving")
      : status.kind === "saved"
        ? t("saved")
        : status.kind === "cleared"
          ? t("cleared")
          : status.kind === "error"
            ? status.message
            : "";

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    // The shop's day, so the server's render and the phone's agree.
    timeZone: "America/New_York",
  });

  return (
    <form ref={formRef} onSubmit={save} className="flex max-w-xl flex-col gap-12">
      <Section title={t("contact")}>
        <Field label={t("name")} error={errors.name}>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={errors.name ? true : undefined}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              value={form.name}
              onChange={(event) => update({ name: event.target.value }, "name")}
              className={inputClass}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-[0.8125rem] font-medium text-ink">{t("email")}</p>
          <p className="break-all rounded-[2px] bg-paper-warm px-4 py-3 text-[1rem] text-ink-soft">
            {initial.email}
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("emailHint")}</p>
        </div>

        <Field label={t("phone")} optional error={errors.phone}>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={errors.phone ? true : undefined}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={30}
              value={form.phone}
              onChange={(event) => update({ phone: event.target.value }, "phone")}
              className={inputClass}
            />
          )}
        </Field>

        {form.phone.trim() ? (
          <ChoiceGroup
            legend={t("preferredContact")}
            value={form.preferredContact}
            onChange={(preferredContact) => update({ preferredContact })}
            options={[
              { value: "whatsapp", label: tc("whatsapp") },
              { value: "phone", label: tc("phone") },
              { value: "email", label: tc("email") },
            ]}
          />
        ) : null}
      </Section>

      <Section title={t("address")} optional={tc("optional")}>
        {form.addressOpen ? (
          <>
            {addressField("line1", { autoComplete: "address-line1", maxLength: 120 })}
            {addressField("line2", { autoComplete: "address-line2", maxLength: 60 }, true)}
            {addressField("city", { autoComplete: "address-level2", maxLength: 60 })}
            <div className="grid grid-cols-[2fr_3fr] gap-4">
              {addressField("state", { autoComplete: "address-level1", maxLength: 30, placeholder: HOME_STATE })}
              {addressField("zip", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 10, className: "tabular-nums" })}
            </div>
            <QuietButton
              onClick={() => {
                update({ addressOpen: false, address: EMPTY_ADDRESS });
                dropErrors("address.");
              }}
            >
              {t("removeAddress")}
            </QuietButton>
          </>
        ) : (
          <QuietButton
            onClick={() =>
              update({
                addressOpen: true,
                address: { ...form.address, state: form.address.state || HOME_STATE },
              })
            }
          >
            {t("addAddress")}
          </QuietButton>
        )}
      </Section>

      <Section title={t("measures")}>
        <ChoiceGroup
          legend={t("unitLegend")}
          value={form.unit}
          onChange={(unit) => {
            if (unit === form.unit) return;
            update({ unit, values: switchUnit(form.values, form.locked, form.unit, unit) });
            // Every number changed, so each is checked again on the next save.
            dropErrors("measurements.");
          }}
          options={[
            { value: "in", label: t("unitIn") },
            { value: "cm", label: t("unitCm") },
          ]}
        />

        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {MEASUREMENTS.map((measurement) => {
            const kept = initial.measurements[measurement.id];
            return (
              <li key={measurement.id}>
                {kept && form.locked.has(measurement.id) ? (
                  <LockedRow
                    label={measurement.label[locale]}
                    howTo={measurement.howTo[locale]}
                    value={bothUnits(kept.value, kept.unit)}
                    taken={t("takenByDaysi", { date: dateFormat.format(new Date(kept.at)) })}
                  />
                ) : (
                  <MeasurementRow
                    label={measurement.label[locale]}
                    howTo={measurement.howTo[locale]}
                    unit={form.unit}
                    unitName={form.unit === "in" ? t("unitIn") : t("unitCm")}
                    value={form.values[measurement.id]}
                    error={errors[`measurements.${measurement.id}`]}
                    onChange={(value) => setValue(measurement.id, value)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={t("notes")}>
        {(headingId) => (
          <TextArea
            aria-labelledby={headingId}
            maxLength={400}
            placeholder={t("notesPlaceholder")}
            value={form.notes}
            onChange={(event) => update({ notes: event.target.value }, "notes")}
            className={inputClass}
          />
        )}
      </Section>

      <div className="flex flex-col gap-4 border-t border-line pt-8">
        <button
          type="submit"
          disabled={busy}
          className={buttonClass({ tone: "solid", size: "medium", className: "w-full sm:w-fit" })}
        >
          {status.kind === "saving" ? t("saving") : t("save")}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`min-h-[1.25rem] text-[0.875rem] leading-relaxed ${
            status.kind === "error" ? "text-alert" : "text-ink-soft"
          }`}
        >
          {statusLine}
        </p>
        {hasOwn ? (
          <QuietButton onClick={clear} disabled={busy}>
            {t("clear")}
          </QuietButton>
        ) : null}
      </div>
    </form>
  );
}

function Section({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: string;
  children: ReactNode | ((headingId: string) => ReactNode);
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6 border-t border-line pt-8">
      <h2 id={headingId} className="text-heading">
        {title}
        {optional ? (
          <span className="ml-2 align-middle font-body text-[0.8125rem] font-normal text-ink-faint">
            ({optional})
          </span>
        ) : null}
      </h2>
      {typeof children === "function" ? children(headingId) : children}
    </section>
  );
}

/** TextLink's look on a button, with a box tall enough for a thumb. */
function QuietButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 w-fit items-center text-[0.8125rem] font-medium text-ink disabled:opacity-40"
    >
      <span className="link-underline">{children}</span>
    </button>
  );
}

function RowLabel({ label, howTo, htmlFor, tipId, extra }: {
  label: string;
  howTo: string;
  htmlFor?: string;
  tipId: string;
  extra?: string;
}) {
  const text = (
    <>
      {label}
      {extra ? <span className="sr-only">, {extra}</span> : null}
    </>
  );
  return (
    <div className="flex min-h-12 items-center gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[1rem] text-ink">
          {text}
        </label>
      ) : (
        <span className="text-[1rem] text-ink">{text}</span>
      )}
      <InfoTip id={tipId} text={howTo} />
    </div>
  );
}

function MeasurementRow({
  label,
  howTo,
  unit,
  unitName,
  value,
  error,
  onChange,
}: {
  label: string;
  howTo: string;
  unit: Unit;
  unitName: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const tipId = `${id}-tip`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-4">
        <RowLabel label={label} howTo={howTo} htmlFor={id} tipId={tipId} extra={unitName} />
        <span
          className={`flex w-[8.5rem] shrink-0 items-center rounded-[2px] border bg-paper transition-colors focus-within:border-ink ${
            error ? "border-alert" : "border-line-strong"
          }`}
        >
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={error ? `${tipId} ${errorId}` : tipId}
            aria-invalid={error ? true : undefined}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            // Selected a frame late, so the tap that focused it does not put the caret back.
            onFocus={(event) => {
              const box = event.currentTarget;
              requestAnimationFrame(() => box.select());
            }}
            className="min-h-12 w-full min-w-0 bg-transparent py-2 pl-3 text-right text-[1rem] tabular-nums text-ink placeholder:text-ink-faint"
          />
          <span aria-hidden className="shrink-0 pl-2 pr-3 text-[0.875rem] text-ink-faint">
            {unit}
          </span>
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LockedRow({ label, howTo, value, taken }: { label: string; howTo: string; value: string; taken: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <RowLabel label={label} howTo={howTo} tipId={`${id}-tip`} />
      <div className="flex flex-col items-end text-right">
        <span className="text-[1rem] tabular-nums text-ink">{value}</span>
        <span className="text-[0.8125rem] text-ink-faint">{taken}</span>
      </div>
    </div>
  );
}
