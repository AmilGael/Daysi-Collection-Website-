"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  translate,
  type AlterationService,
  type DesignCategory,
  type Fabric,
} from "@/content";
import { formatMoney } from "@/lib/money";
import type { Estimate } from "@/lib/pricing";
import { Link, type Locale } from "@/i18n/routing";
import { whatsappLink } from "@/lib/whatsapp";
import { TextLink } from "@/components/ui";
import {
  BotTrap,
  Checkbox,
  ChoiceGroup,
  Field,
  FormError,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  useRenderedAt,
  useSubmit,
} from "./form";
import { EstimateSummary } from "./estimate-summary";

type Kind = "alteration" | "commission";
type ContactMethod = "whatsapp" | "phone" | "email";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * The one form Daysi's business runs on. It covers both kinds of request with
 * the same fields for who you are and how to reach you, and swaps only the
 * part that describes the work. A garment from the collection is not one of
 * them: it is bought through the cart, where it is paid for.
 *
 * Nothing here computes a price the client can send: the server re-prices every
 * submission from the published list and returns the estimate it produced.
 */
export function RequestForm({
  initialKind,
  lockedKind,
  initialAlterationId,
  alterations,
  categories,
  fabrics,
}: {
  initialKind: Kind;
  lockedKind: Kind | null;
  initialAlterationId?: string;
  alterations: readonly AlterationService[];
  categories: readonly DesignCategory[];
  fabrics: readonly Fabric[];
}) {
  const t = useTranslations("request");
  const tc = useTranslations("common");
  const ta = useTranslations("alterations");
  const locale = useLocale() as Locale;
  const renderedAt = useRenderedAt();
  const { state, submit } = useSubmit("/api/requests");

  const [kind, setKind] = useState<Kind>(initialKind);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactMethod>("whatsapp");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [notes, setNotes] = useState("");

  // Alteration
  const [garmentDescription, setGarmentDescription] = useState("");
  const [alterationIds, setAlterationIds] = useState<string[]>(
    initialAlterationId &&
      alterations.some((alteration) => alteration.id === initialAlterationId)
      ? [initialAlterationId]
      : [],
  );
  const [rush, setRush] = useState(false);
  const [preferredTiming, setPreferredTiming] = useState("");
  const [photo, setPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Commission
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [occasion, setOccasion] = useState("");
  const [neededBy, setNeededBy] = useState("");

  const [estimate, setEstimate] = useState<Estimate | null>(null);

  // Only the email is required: a phone left blank means there is no way to
  // reach the guest by WhatsApp or by phone, whatever the pills above say, so
  // the effective method falls back to email until a number is typed.
  const contactMethod: ContactMethod = phone.trim() ? preferredContact : "email";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = {
      name: name.trim() ? name : undefined,
      email,
      phone: phone.trim() ? phone : undefined,
      preferredContact: contactMethod,
      locale,
    };
    const common = { website: "", renderedAt, client, notes, acceptedTerms: true as const };

    const body =
      kind === "alteration"
        ? {
            ...common,
            kind,
            garmentDescription,
            alterationIds,
            rush,
            preferredTiming,
            photoDataUrl: photo?.dataUrl,
          }
        : { ...common, kind, categoryId, fabricId, customize: true as const, occasion, neededBy };

    const result = await submit(body);
    if (result?.estimate) setEstimate(result.estimate);
  }

  function onPhotoChange(file: File | undefined) {
    setPhotoError(null);
    if (!file) {
      setPhoto(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(t("photoHelp"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto({ dataUrl: String(reader.result), name: file.name });
    reader.readAsDataURL(file);
  }

  if (state.status === "done") {
    return (
      <div className="flex max-w-2xl flex-col gap-6 bg-paper-warm p-8 sm:p-12">
        <h2 className="text-title">{t("sentTitle")}</h2>
        <p className="text-lead text-ink-soft">
          {t("sentLead", { reference: state.reference, contact: tc(contactMethod) })}
        </p>
        {estimate ? (
          <div className="flex flex-col gap-4">
            <p className="text-[0.875rem] text-ink-soft">{t("sentEstimate")}</p>
            <EstimateSummary estimate={estimate} />
          </div>
        ) : null}
        <p className="text-[0.875rem] text-ink-faint">{t("sentNext")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative flex max-w-2xl flex-col gap-10">
      <BotTrap renderedAt={renderedAt} />

      {lockedKind ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-heading">
            {t(kind === "alteration" ? "kindAlteration" : "kindCommission")}
          </h2>
          <TextLink href="/request">{t("changeKind")}</TextLink>
        </div>
      ) : (
        <ChoiceGroup
          legend={t("title")}
          columns
          value={kind}
          onChange={setKind}
          options={[
            { value: "alteration", label: t("kindAlteration") },
            { value: "commission", label: t("kindCommission") },
          ]}
        />
      )}

      {kind === "alteration" ? (
        <section className="flex flex-col gap-6">
          <Field label={t("garment")}>
            {({ id, describedBy }) => (
              <TextArea
                id={id}
                aria-describedby={describedBy}
                required
                minLength={10}
                value={garmentDescription}
                onChange={(event) => setGarmentDescription(event.target.value)}
                placeholder={t("garmentPlaceholder")}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[0.8125rem] font-medium">
              {t("whatNeedsChanging")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {alterations.map((alteration) => {
                const checked = alterationIds.includes(alteration.id);
                return (
                  <label
                    key={alteration.id}
                    className={`flex cursor-pointer items-start justify-between gap-3 rounded-[2px] border p-3.5 text-[0.875rem] transition-colors ${
                      checked ? "border-ink" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setAlterationIds((current) =>
                            event.target.checked
                              ? [...current, alteration.id]
                              : current.filter((id) => id !== alteration.id),
                          )
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
                      />
                      {translate(alteration.name, locale)}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-faint">
                      {formatMoney(alteration.fixedPrice, locale)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Checkbox checked={rush} onChange={setRush}>
            {ta("rushTitle")} {ta("rushLead")}
          </Checkbox>

          <Field label={t("timing")}>
            {({ id }) => (
              <TextInput
                id={id}
                value={preferredTiming}
                onChange={(event) => setPreferredTiming(event.target.value)}
                placeholder={t("timingPlaceholder")}
              />
            )}
          </Field>

          <Field label={t("photo")} hint={t("photoHelp")} error={photoError ?? undefined} optional>
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-3">
                <input
                  id={id}
                  aria-describedby={describedBy}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => onPhotoChange(event.target.files?.[0])}
                  className="text-[0.875rem] file:mr-4 file:rounded-[2px] file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[0.8125rem] file:text-paper"
                />
                {photo ? (
                  <div className="flex items-center gap-4">
                    <Image
                      src={photo.dataUrl}
                      alt=""
                      width={72}
                      height={72}
                      unoptimized
                      className="h-18 w-18 rounded-[2px] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      className="link-underline text-[0.8125rem]"
                    >
                      {t("photoRemove")}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </Field>
        </section>
      ) : null}

      {kind === "commission" ? (
        <section className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t("kindCommission")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {translate(category.name, locale)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={tc("customization")}>
              {({ id }) => (
                <Select id={id} value={fabricId} onChange={(event) => setFabricId(event.target.value)}>
                  {fabrics.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {translate(fabric.name, locale)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t("occasion")}>
              {({ id }) => (
                <TextInput
                  id={id}
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value)}
                  placeholder={t("occasionPlaceholder")}
                />
              )}
            </Field>
            <Field label={t("neededBy")}>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="date"
                  value={neededBy}
                  onChange={(event) => setNeededBy(event.target.value)}
                />
              )}
            </Field>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-6 border-t border-line pt-10">
        <h2 className="text-heading">{t("yourDetails")}</h2>
        <Field label={t("email")}>
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

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={t("name")} optional>
            {({ id }) => (
              <TextInput
                id={id}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("phone")} optional hint={t("whatsappHint")}>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </Field>
        </div>

        {phone.trim() ? (
          <ChoiceGroup
            legend={t("preferredContact")}
            value={preferredContact}
            onChange={setPreferredContact}
            options={[
              { value: "whatsapp", label: tc("whatsapp") },
              { value: "phone", label: tc("phone") },
              { value: "email", label: tc("email") },
            ]}
          />
        ) : null}

        <Field label={t("notes")} optional>
          {({ id }) => (
            <TextArea id={id} value={notes} onChange={(event) => setNotes(event.target.value)} />
          )}
        </Field>
      </section>

      <div className="flex flex-col gap-5 border-t border-line pt-8">
        <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
          {t.rich("terms", {
            link: (chunks) => (
              <Link href="/terms" className="link-underline">
                {chunks}
              </Link>
            ),
          })}
        </Checkbox>

        <FormError state={state} />

        <div className="flex flex-wrap items-center gap-5">
          <SubmitButton state={state} disabled={!acceptedTerms}>
            {t("submit")}
          </SubmitButton>
          <a
            href={whatsappLink(locale === "es" ? "Hola Daysi, quisiera…" : "Hi Daysi, I'd like…")}
            target="_blank"
            rel="noreferrer noopener"
            className="link-underline text-[0.875rem]"
          >
            {t("orWhatsapp")}
          </a>
        </div>
      </div>
    </form>
  );
}
