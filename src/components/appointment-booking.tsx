"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate, type AppointmentType } from "@/content";
import { formatMoney } from "@/lib/money";
import type { Estimate } from "@/lib/pricing";
import type { DaySlots } from "@/lib/availability";
import { Link, type Locale } from "@/i18n/routing";
import {
  BotTrap,
  Checkbox,
  ChoiceGroup,
  Field,
  FormError,
  SubmitButton,
  TextArea,
  TextInput,
  useRenderedAt,
  useSubmit,
} from "./form";
import { EstimateSummary } from "./estimate-summary";

type ContactMethod = "whatsapp" | "phone" | "email";

/**
 * Booking, in the order a person actually decides: which session, then when,
 * then who they are. Availability is fetched for the chosen session length
 * because a one-hour sitting needs two consecutive slots free, not one.
 */
export function AppointmentBooking({
  appointmentTypes,
  paymentsEnabled,
  creditDays,
}: {
  appointmentTypes: readonly AppointmentType[];
  paymentsEnabled: boolean;
  creditDays: number;
}) {
  const t = useTranslations("appointments");
  const tr = useTranslations("request");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const renderedAt = useRenderedAt();
  const { state, submit } = useSubmit("/api/appointments");

  const [typeId, setTypeId] = useState(appointmentTypes[0]?.id ?? "");
  const [days, setDays] = useState<readonly DaySlots[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactMethod>("whatsapp");
  const [purpose, setPurpose] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  const selectedType = appointmentTypes.find((type) => type.id === typeId);

  useEffect(() => {
    const controller = new AbortController();
    setDate(null);
    setStartTime(null);

    fetch(`/api/appointments?type=${encodeURIComponent(typeId)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { days: DaySlots[]; estimate: Estimate } | null) => {
        setDays(result?.days ?? []);
        setEstimate(result?.estimate ?? null);
        setDate(result?.days[0]?.date ?? null);
      })
      .catch(() => {
        /* Aborted while switching session type. */
      });

    return () => controller.abort();
  }, [typeId]);

  const selectedDay = days.find((day) => day.date === date);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || !startTime) return;

    const result = await submit({
      website: "",
      renderedAt,
      appointmentTypeId: typeId,
      date,
      startTime,
      purpose,
      acceptedTerms: true,
      client: { name, email, phone, preferredContact, locale },
    });

    if (result?.checkoutUrl) window.location.assign(result.checkoutUrl);
  }

  if (state.status === "done") {
    return (
      <div className="flex max-w-2xl flex-col gap-6 bg-paper-warm p-8 sm:p-12">
        <h2 className="text-title">{t("bookedTitle")}</h2>
        <p className="text-lead text-ink-soft">
          {t("bookedLead", { reference: state.reference, contact: tc(preferredContact) })}
        </p>
        {estimate ? <EstimateSummary estimate={estimate} /> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
      <BotTrap renderedAt={renderedAt} />

      <div className="flex flex-col gap-10">
        <ChoiceGroup
          legend={t("chooseType")}
          columns
          value={typeId}
          onChange={setTypeId}
          options={appointmentTypes.map((type) => ({
            value: type.id,
            label: translate(type.name, locale),
            description: `${t("minutes", { count: type.minutes })} · ${formatMoney(type.fee, locale)}`,
          }))}
        />

        {selectedType ? (
          <div className="flex flex-col gap-3 border-l-2 border-marigold pl-5">
            <p className="leading-relaxed text-ink-soft">
              {translate(selectedType.description, locale)}
            </p>
            <ul className="flex flex-col gap-1.5">
              {selectedType.suitedFor.map((item) => (
                <li key={item.en} className="flex items-start gap-2.5 text-[0.875rem] text-ink-faint">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                  {translate(item, locale)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {days.length === 0 ? (
          <p className="border border-dashed border-line px-6 py-10 text-[0.9375rem] text-ink-faint">
            {t("noSlots")}
          </p>
        ) : (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-[0.8125rem] font-medium">{t("chooseDate")}</legend>
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
                {days.slice(0, 21).map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    aria-pressed={day.date === date}
                    onClick={() => {
                      setDate(day.date);
                      setStartTime(null);
                    }}
                    className={`flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-lg border px-3 py-3 transition-colors ${
                      day.date === date
                        ? "border-ink bg-ink text-paper"
                        : "border-line hover:border-ink/50"
                    }`}
                  >
                    <span className="text-[0.625rem] uppercase tracking-[0.12em] opacity-65">
                      {weekdayLabel(day.date, locale)}
                    </span>
                    <span className="text-[1.125rem] font-medium">{dayNumber(day.date)}</span>
                    <span className="text-[0.625rem] uppercase tracking-[0.12em] opacity-65">
                      {monthLabel(day.date, locale)}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {selectedDay ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-[0.8125rem] font-medium">{t("chooseTime")}</legend>
                <div className="flex flex-wrap gap-2">
                  {selectedDay.slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={slot === startTime}
                      onClick={() => setStartTime(slot)}
                      className={`rounded-full border px-4 py-2 text-[0.875rem] tabular-nums transition-colors ${
                        slot === startTime
                          ? "border-ink bg-ink text-paper"
                          : "border-line hover:border-ink/50"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </>
        )}

        <Field label={t("purpose")}>
          {({ id }) => (
            <TextArea
              id={id}
              required
              minLength={10}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder={t("purposePlaceholder")}
            />
          )}
        </Field>

        <section className="flex flex-col gap-6 border-t border-line pt-10">
          <h2 className="text-heading">{tr("yourDetails")}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={tr("name")}>
              {({ id }) => (
                <TextInput
                  id={id}
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
            <Field label={tr("phone")}>
              {({ id }) => (
                <TextInput
                  id={id}
                  required
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label={tr("email")}>
            {({ id }) => (
              <TextInput
                id={id}
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <ChoiceGroup
            legend={tr("preferredContact")}
            value={preferredContact}
            onChange={setPreferredContact}
            options={[
              { value: "whatsapp", label: tc("whatsapp") },
              { value: "phone", label: tc("phone") },
              { value: "email", label: tc("email") },
            ]}
          />
        </section>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-heading">{t("confirmTitle")}</h2>

        {estimate ? <EstimateSummary estimate={estimate} /> : null}

        {selectedType ? (
          <div className="flex flex-col gap-3 text-[0.8125rem] leading-relaxed text-ink-faint">
            <p>
              {t("overtimeNotice", {
                rate: formatMoney(selectedType.overtimeRatePerHalfHour, locale),
              })}
            </p>
            <p>{t("creditNotice", { days: creditDays })}</p>
          </div>
        ) : null}

        <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
          {tr.rich("terms", {
            link: (chunks) => (
              <Link href="/terms" className="link-underline">
                {chunks}
              </Link>
            ),
          })}
        </Checkbox>

        <FormError state={state} />

        <SubmitButton state={state} disabled={!acceptedTerms || !date || !startTime}>
          {paymentsEnabled ? t("confirmCta") : t("confirmCtaNoPayment")}
        </SubmitButton>
      </aside>
    </form>
  );
}

function formatDatePart(date: string, locale: Locale, options: Intl.DateTimeFormatOptions) {
  // The slot dates are plain calendar days; parsing at noon keeps them from
  // sliding a day either way when the browser applies its own zone.
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", options).format(
    new Date(`${date}T12:00:00`),
  );
}

const weekdayLabel = (date: string, locale: Locale) =>
  formatDatePart(date, locale, { weekday: "short" });
const monthLabel = (date: string, locale: Locale) =>
  formatDatePart(date, locale, { month: "short" });
const dayNumber = (date: string) => date.slice(8, 10);
