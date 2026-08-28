"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  translate,
  type Cents,
  type GarmentStyle,
  type Localized,
  type Size,
  type SizeId,
} from "@/content";
import { formatMoney } from "@/lib/money";
import { Link, useRouter, type Locale } from "@/i18n/routing";
import { buttonClass } from "./ui";

/**
 * Size, customisation and the running price on a style page. The total updates
 * as the choice changes, and the choice is carried into the request form as
 * query parameters — the server re-prices it from the price list rather than
 * trusting the number shown here.
 */
export function StyleOrderPanel({
  style,
  sizes,
  fixedPrice,
  customizationExtra,
  customizationNote,
}: {
  style: GarmentStyle;
  sizes: readonly Size[];
  fixedPrice: Cents;
  customizationExtra: Cents;
  customizationNote: Localized;
}) {
  const t = useTranslations("style");
  const tc = useTranslations("common");
  const tcart = useTranslations("cart");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [addState, setAddState] = useState<"idle" | "adding" | "added">("idle");

  const firstAvailable = style.sizes.find((size) => size.inStock) ?? style.sizes[0];
  const [sizeId, setSizeId] = useState<SizeId | undefined>(firstAvailable?.sizeId);
  const [customize, setCustomize] = useState(false);

  const total = fixedPrice + (customize ? customizationExtra : 0);
  const requestHref = `/request?kind=order&style=${style.slug}${
    sizeId ? `&size=${sizeId}` : ""
  }${customize ? "&customize=1" : ""}`;

  async function addToCart() {
    if (!sizeId) return;
    setAddState("adding");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add",
          styleSlug: style.slug,
          sizeId,
          customize,
        }),
      });
      setAddState(response.ok ? "added" : "idle");
      // The cart badge lives in the header, which the server renders.
      if (response.ok) router.refresh();
    } catch {
      setAddState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[0.8125rem] font-medium">{t("chooseSize")}</legend>
        <div className="flex flex-wrap gap-2">
          {style.sizes.map((offered) => {
            const size = sizes.find((candidate) => candidate.id === offered.sizeId);
            const isSelected = offered.sizeId === sizeId;
            return (
              <button
                key={offered.sizeId}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSizeId(offered.sizeId)}
                className={`flex min-w-16 flex-col items-center gap-0.5 rounded-[2px] border px-4 py-2.5 transition-colors ${
                  isSelected
                    ? "border-ink bg-ink text-paper"
                    : "border-line hover:border-ink/50"
                }`}
              >
                <span className="text-sm font-medium">{size?.label ?? offered.sizeId}</span>
                <span
                  className={`text-[0.625rem] uppercase tracking-[0.1em] ${
                    isSelected ? "text-paper-faint" : "text-ink-faint"
                  }`}
                >
                  {offered.inStock ? tc("inStock") : tc("madeToOrder")}
                </span>
              </button>
            );
          })}
        </div>
        {sizeId ? (
          <p className="text-[0.8125rem] text-ink-faint">
            {t("sizeGuide")}:{" "}
            {translate(
              sizes.find((size) => size.id === sizeId)?.measurements ?? { en: "", es: "" },
              locale,
            )}
          </p>
        ) : null}
      </fieldset>

      {style.customizationAvailable ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-[2px] border border-line p-4 transition-colors has-checked:border-ink">
          <input
            type="checkbox"
            checked={customize}
            onChange={(event) => setCustomize(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-ink"
          />
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-baseline gap-2 text-[0.9375rem] font-medium">
              {t("customizeLabel")}
              <span className="text-ink-faint">+ {formatMoney(customizationExtra, locale)}</span>
            </span>
            <span className="text-[0.8125rem] leading-relaxed text-ink-faint">
              {translate(customizationNote, locale)}
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-col gap-5 border-t border-line pt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
            {tc("fixedPrice")}
          </span>
          <span className="font-display text-[2rem] tabular-nums leading-none">
            {formatMoney(total, locale)}
          </span>
        </div>
        <button
          type="button"
          onClick={addToCart}
          disabled={!sizeId || addState === "adding"}
          className={buttonClass({ className: "w-full" })}
        >
          {addState === "added" ? tcart("added") : tcart("addToCart")}
        </button>
        <Link
          href={requestHref}
          className={buttonClass({ tone: "outline", className: "w-full" })}
        >
          {t("orderCta")}
        </Link>
        <p className="text-[0.8125rem] text-ink-faint">{t("notInYourSize")}</p>
      </div>
    </div>
  );
}
