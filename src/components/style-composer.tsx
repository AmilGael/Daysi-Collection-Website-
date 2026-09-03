"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/i18n/routing";
import type { CollectionChange } from "@/lib/office-validation";
import { useOfficeDraft } from "./office/use-office-draft";
import { buttonClass } from "./ui";

export type ComposerCategory = { readonly id: string; readonly label: string };
export type ComposerFabric = { readonly id: string; readonly label: string };
/** Garment-and-cloth pairs that already carry a published price, in cents. */
export type ComposerPrices = Readonly<Record<string, number>>;

const SIZES = ["s", "m", "l"] as const;

/**
 * Adding a garment to the collection, which until now needed a developer.
 *
 * The form asks for what Daysi would say anyway when showing a new piece: what
 * it is, what it is made of, which sizes she has, and photographs. The price is
 * the one part that cannot be guessed — where the garment and cloth are already
 * on the price list she is shown that figure and cannot contradict it here,
 * because the price list is the one place prices are decided. Where the pair is
 * new, what she types becomes its published price.
 */
export function StyleComposer({
  categories,
  fabrics,
  pricedPairs,
  locale,
}: {
  categories: readonly ComposerCategory[];
  fabrics: readonly ComposerFabric[];
  pricedPairs: ComposerPrices;
  // A locale rather than a formatter: functions do not cross the server and
  // client boundary, and formatMoney is pure so it works on both sides.
  locale: Locale;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nameEs, setNameEs] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [descriptionEs, setDescriptionEs] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [detailEs, setDetailEs] = useState("");
  const [detailEn, setDetailEn] = useState("");
  const [detailTouched, setDetailTouched] = useState(false);
  const [colorEs, setColorEs] = useState("");
  const [colorEn, setColorEn] = useState("");
  const [colorTouched, setColorTouched] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState({ s: true, m: true, l: true });
  const [problem, setProblem] = useState<string | null>(null);

  const existingPrice = pricedPairs[`${categoryId}--${fabricId}`];
  const needsPrice = existingPrice === undefined;

  function changeNameEs(value: string) {
    setNameEs(value);
    if (!nameTouched) setNameEn(value);
  }

  function changeDescriptionEs(value: string) {
    setDescriptionEs(value);
    if (!descriptionTouched) setDescriptionEn(value);
  }

  function changeDetailEs(value: string) {
    setDetailEs(value);
    if (!detailTouched) setDetailEn(value);
  }

  function changeColorEs(value: string) {
    setColorEs(value);
    if (!colorTouched) setColorEn(value);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = [...(fileRef.current?.files ?? [])];
    setProblem(null);

    if (files.length === 0) return setProblem(t("stylePhotoRequired"));
    if (!SIZES.some((size) => sizes[size])) return setProblem(t("styleSizeRequired"));
    if (needsPrice && !(parseFloat(price) > 0)) return setProblem(t("stylePriceRequired"));

    const key = `style-create:${crypto.randomUUID()}`;
    const wire: CollectionChange = {
      type: "style-create",
      key,
      name: { es: nameEs.trim(), en: nameEn.trim() },
      description: { es: descriptionEs.trim(), en: descriptionEn.trim() },
      detail: { es: detailEs.trim(), en: detailEn.trim() },
      color: { es: colorEs.trim(), en: colorEn.trim() },
      categoryId,
      fabricId,
      sizes,
      photos: [],
      ...(needsPrice ? { fixedPrice: Math.round(parseFloat(price) * 100) } : {}),
    };
    draft.stage(key, {
      wire,
      files: files.slice(0, 8),
      withUploads: (srcs) => ({ ...wire, photos: [...srcs] }),
    });

    setNameEs("");
    setNameEn("");
    setNameTouched(false);
    setDescriptionEs("");
    setDescriptionEn("");
    setDescriptionTouched(false);
    setDetailEs("");
    setDetailEn("");
    setDetailTouched(false);
    setColorEs("");
    setColorEn("");
    setColorTouched(false);
    setPrice("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <PairField label={t("styleName")} spanish={t("textsSpanish")} english={t("textsEnglish")}
          es={nameEs} en={nameEn} onEs={changeNameEs}
          onEn={(value) => { setNameTouched(true); setNameEn(value); }} minLength={2} maxLength={60}
          placeholder={t("styleNamePlaceholder")} required />
        <PairField label={t("styleColor")} spanish={t("textsSpanish")} english={t("textsEnglish")}
          es={colorEs} en={colorEn} onEs={changeColorEs}
          onEn={(value) => { setColorTouched(true); setColorEn(value); }} maxLength={80}
          placeholder={t("styleColorPlaceholder")} />
      </div>

      <PairField label={t("styleDescription")} spanish={t("textsSpanish")} english={t("textsEnglish")}
        es={descriptionEs} en={descriptionEn} onEs={changeDescriptionEs}
        onEn={(value) => { setDescriptionTouched(true); setDescriptionEn(value); }} minLength={10} maxLength={400}
        placeholder={t("styleDescriptionPlaceholder")} required multiline />

      <PairField label={t("styleDetail")} spanish={t("textsSpanish")} english={t("textsEnglish")}
        es={detailEs} en={detailEn} onEs={changeDetailEs}
        onEn={(value) => { setDetailTouched(true); setDetailEn(value); }} maxLength={400}
        placeholder={t("styleDetailPlaceholder")} multiline />

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={t("styleCategory")}>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("styleFabric")}>
          <select
            value={fabricId}
            onChange={(event) => setFabricId(event.target.value)}
            className={inputClass}
          >
            {fabrics.map((fabric) => (
              <option key={fabric.id} value={fabric.id}>
                {fabric.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("stylePrice")}>
          {needsPrice ? (
            <span className="flex items-center border border-line bg-paper px-2 focus-within:border-ink">
              <span className="text-[0.8125rem] text-ink-faint">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="w-full bg-transparent py-2 pl-1 text-[0.9375rem] tabular-nums text-ink"
              />
            </span>
          ) : (
            <p className="py-2 text-[0.9375rem] tabular-nums text-ink-soft">
              {formatMoney(existingPrice, locale)}
              <span className="ml-2 text-[0.75rem] text-ink-faint">{t("stylePriceFromList")}</span>
            </p>
          )}
        </Field>
      </div>

      <fieldset className="flex items-center gap-5">
        <legend className="mb-2 text-[0.75rem] text-ink-faint">{t("styleSizes")}</legend>
        {SIZES.map((size) => (
          <label key={size} className="flex cursor-pointer items-center gap-2 text-[0.8125rem] uppercase">
            <input
              type="checkbox"
              checked={sizes[size]}
              onChange={(event) => setSizes({ ...sizes, [size]: event.target.checked })}
              className="h-4 w-4 accent-ink"
            />
            {size}
          </label>
        ))}
      </fieldset>

      <Field label={t("stylePhotos")}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className={buttonClass({ size: "small", tone: "solid" })}
        >
          {t("styleSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("styleNote")}</p>
    </form>
  );
}

const inputClass =
  "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
      {label}
      {children}
    </label>
  );
}

function PairField({ label, spanish, english, es, en, onEs, onEn, minLength, maxLength,
  placeholder, required = false, multiline = false }: {
  label: string;
  spanish: string;
  english: string;
  es: string;
  en: string;
  onEs: (value: string) => void;
  onEn: (value: string) => void;
  minLength?: number;
  maxLength: number;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const control = (locale: "es" | "en") => {
    const props = {
      value: locale === "es" ? es : en,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        (locale === "es" ? onEs : onEn)(event.target.value),
      minLength,
      maxLength,
      required,
      placeholder,
      className: `${inputClass}${multiline ? " resize-none" : ""}`,
      "aria-label": `${label}, ${locale === "es" ? spanish : english}`,
    };
    return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="text-[0.75rem] text-ink-faint">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">{spanish}{control("es")}</label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">{english}{control("en")}</label>
      </div>
    </fieldset>
  );
}
