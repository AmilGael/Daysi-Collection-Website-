"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/i18n/routing";
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState("");
  const [color, setColor] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState({ s: true, m: true, l: true });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const existingPrice = pricedPairs[`${categoryId}--${fabricId}`];
  const needsPrice = existingPrice === undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = [...(fileRef.current?.files ?? [])];
    setProblem(null);

    if (files.length === 0) return setProblem(t("stylePhotoRequired"));
    if (!SIZES.some((size) => sizes[size])) return setProblem(t("styleSizeRequired"));
    if (needsPrice && !(parseFloat(price) > 0)) return setProblem(t("stylePriceRequired"));

    setState("saving");
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, 8)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/office/uploads", { method: "POST", body: form });
        if (!response.ok) throw new Error("upload-failed");
        uploaded.push(((await response.json()) as { src: string }).src);
      }

      const saved = await fetch("/api/office/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          detail: detail.trim(),
          color: color.trim(),
          categoryId,
          fabricId,
          sizes,
          photos: uploaded,
          ...(needsPrice ? { fixedPrice: Math.round(parseFloat(price) * 100) } : {}),
        }),
      });
      if (!saved.ok) throw new Error("save-failed");

      setState("saved");
      setName("");
      setDescription("");
      setDetail("");
      setColor("");
      setPrice("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("styleName")}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={60}
            placeholder={t("styleNamePlaceholder")}
            className={inputClass}
          />
        </Field>
        <Field label={t("styleColor")}>
          <input
            value={color}
            onChange={(event) => setColor(event.target.value)}
            maxLength={80}
            placeholder={t("styleColorPlaceholder")}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={t("styleDescription")}>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          minLength={10}
          maxLength={400}
          rows={2}
          placeholder={t("styleDescriptionPlaceholder")}
          className={`${inputClass} resize-none`}
        />
      </Field>

      <Field label={t("styleDetail")}>
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          maxLength={400}
          rows={2}
          placeholder={t("styleDetailPlaceholder")}
          className={`${inputClass} resize-none`}
        />
      </Field>

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
          disabled={state === "saving"}
          className={buttonClass({ size: "small", tone: "solid" })}
        >
          {state === "saving" ? t("saving") : t("styleSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
        {state === "saved" ? (
          <span className="text-[0.8125rem] text-marigold-deep">{t("styleSaved")}</span>
        ) : null}
        {state === "failed" ? (
          <span className="text-[0.8125rem] text-ink">{t("updateFailed")}</span>
        ) : null}
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
