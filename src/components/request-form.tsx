"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  shopDay,
  translate,
  type AlterationService,
  type DesignCategory,
  type Fabric,
  type PriceListEntry,
} from "@/content";
import { formatMoney } from "@/lib/money";
import type { Estimate } from "@/lib/pricing";
import type { RequestPrefill } from "@/lib/estimate-handoff";
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
import { MoreBox } from "./more-box";

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
  prefill,
  alterations,
  categories,
  fabrics,
  priceList,
}: {
  initialKind: Kind;
  lockedKind: Kind | null;
  /** What was chosen on the way here, already checked by the page. */
  prefill: RequestPrefill;
  alterations: readonly AlterationService[];
  categories: readonly DesignCategory[];
  fabrics: readonly Fabric[];
  /** Only the cloths a garment is priced in are offered for it. */
  priceList: readonly PriceListEntry[];
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
  const [alterationIds, setAlterationIds] = useState<string[]>([...prefill.alterationIds]);
  const [rush, setRush] = useState(prefill.rush);
  const [preferredTiming, setPreferredTiming] = useState("");
  const [photo, setPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Commission
  const [categoryId, setCategoryId] = useState(prefill.categoryId ?? categories[0]?.id ?? "");
  const fabricsForCategory = useMemo(
    () =>
      fabrics.filter((fabric) =>
        priceList.some((entry) => entry.categoryId === categoryId && entry.fabricId === fabric.id),
      ),
    [fabrics, priceList, categoryId],
  );
  const [fabricId, setFabricId] = useState(prefill.fabricId ?? fabricsForCategory[0]?.id ?? "");

  // Changing the garment can strand a cloth it is not made in, which the
  // server would refuse only after the whole form was filled in.
  useEffect(() => {
    if (!fabricsForCategory.some((fabric) => fabric.id === fabricId)) {
      setFabricId(fabricsForCategory[0]?.id ?? "");
    }
  }, [fabricsForCategory, fabricId]);
  const [occasion, setOccasion] = useState("");
  const [neededBy, setNeededBy] = useState("");

  const [estimate, setEstimate] = useState<Estimate | null>(null);

  // The earliest day the timing calendar offers, as the day it is at the atelier.
  const today = shopDay(new Date());

  // Only what the client picked is shown; the rest waits in the select below
  // it. Chosen ones keep the order they were picked in, which is the order
  // the request lists them in.
  const chosenAlterations = alterationIds.flatMap((id) => {
    const alteration = alterations.find((candidate) => candidate.id === id);
    return alteration ? [alteration] : [];
  });
  const remainingAlterations = alterations.filter(
    (alteration) => !alterationIds.includes(alteration.id),
  );

  function addAlteration(id: string) {
    if (!id) return;
    setAlterationIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function removeAlteration(id: string) {
    setAlterationIds((current) => current.filter((chosen) => chosen !== id));
  }

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
        : {
            ...common,
            kind,
            categoryId,
            fabricId,
            customize: true as const,
            occasion,
            neededBy,
            photoDataUrl: photo?.dataUrl,
          };

    const result = await submit(body);
    if (result?.estimate) setEstimate(result.estimate);
  }

  const photoInput = useRef<HTMLInputElement>(null);

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

  // Both kinds take a photo: the piece to be altered, or what the client has
  // in mind for one made from scratch. The label itself says which. The
  // browser's own file button is hidden: it speaks the browser's language
  // ("Choose File") whatever language the page is in.
  const photoField = (
    <Field
      label={t(kind === "alteration" ? "photoNoticeAlteration" : "photoNoticeCommission")}
      hint={t("photoHelp")}
      error={photoError ?? undefined}
      optional
    >
      {({ id, describedBy }) => (
        <div className="flex flex-col gap-3">
          <label
            htmlFor={id}
            className="flex cursor-pointer items-center gap-4 rounded-[2px] border border-dashed border-line-strong p-4 transition-colors hover:border-ink focus-within:border-ink"
          >
            {photo ? (
              <Image
                src={photo.dataUrl}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-[2px] object-cover"
              />
            ) : (
              <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[2px] bg-paper-warm text-ink-soft">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-medium text-ink">
                {photo ? t("photoChange") : t("photoChoose")}
              </span>
              <span className="truncate text-[0.75rem] text-ink-faint">{photo ? photo.name : t("photoTypes")}</span>
            </span>
          </label>
          <input
            ref={photoInput}
            id={id}
            aria-describedby={describedBy}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onPhotoChange(event.target.files?.[0])}
            className="sr-only"
          />
          {photo ? (
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                // So choosing the same file again still counts as a change.
                if (photoInput.current) photoInput.current.value = "";
              }}
              className="link-underline w-fit text-[0.8125rem]"
            >
              {t("photoRemove")}
            </button>
          ) : null}
        </div>
      )}
    </Field>
  );

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
            {chosenAlterations.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {chosenAlterations.map((alteration) => (
                  <li
                    key={alteration.id}
                    className="flex items-center justify-between gap-3 rounded-[2px] border border-ink bg-paper py-2.5 pl-3.5 pr-1.5 text-[0.875rem]"
                  >
                    <span>{translate(alteration.name, locale)}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="tabular-nums text-ink-faint">
                        {formatMoney(alteration.fixedPrice, locale)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAlteration(alteration.id)}
                        aria-label={t("removeAlteration", { name: translate(alteration.name, locale) })}
                        className="flex h-8 w-8 items-center justify-center rounded-[2px] text-[1.125rem] leading-none text-ink-soft transition-colors hover:bg-paper-warm hover:text-ink"
                      >
                        <span aria-hidden>×</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {remainingAlterations.length > 0 ? (
              // A controlled value of "" puts the select back on its first
              // line after every pick, ready for the next one. It is required
              // only while nothing is chosen, since a request needs one.
              <Select
                aria-label={t(alterationIds.length > 0 ? "addAlteration" : "chooseAlteration")}
                required={alterationIds.length === 0}
                value=""
                onChange={(event) => addAlteration(event.target.value)}
              >
                <option value="">
                  {t(alterationIds.length > 0 ? "addAlteration" : "chooseAlteration")}
                </option>
                {remainingAlterations.map((alteration) => (
                  <option key={alteration.id} value={alteration.id}>
                    {translate(alteration.name, locale)}, {formatMoney(alteration.fixedPrice, locale)}
                  </option>
                ))}
              </Select>
            ) : null}
          </fieldset>

          <Checkbox checked={rush} onChange={setRush}>
            {ta("rushTitle")} {ta("rushLead")}
          </Checkbox>

          <Field label={t("timing")} optional>
            {({ id }) => (
              <TextInput
                id={id}
                type="date"
                min={today}
                value={preferredTiming}
                onChange={(event) => setPreferredTiming(event.target.value)}
              />
            )}
          </Field>

          {photoField}
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
                  {fabricsForCategory.map((fabric) => (
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
                  min={today}
                  value={neededBy}
                  onChange={(event) => setNeededBy(event.target.value)}
                />
              )}
            </Field>
          </div>

          {photoField}
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
          <Field label={t("phone")} optional tip={t("whatsappHint")}>
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

        <MoreBox value={notes}>
          <Field label={t("notes")} optional>
            {({ id }) => (
              <TextArea id={id} value={notes} onChange={(event) => setNotes(event.target.value)} />
            )}
          </Field>
        </MoreBox>
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
