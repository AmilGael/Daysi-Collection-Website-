"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  translate,
  type DesignCategory,
  type GarmentStyle,
  type Size,
  type SizeId,
} from "@/content";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { LookbookGrid, StyleCard } from "./style-card";
import { buttonClass } from "./ui";

/**
 * The lookbook with its two filters, by design and by size.
 *
 * The filters are set as a line of type rather than a row of pills: a fashion
 * house lists its categories, it does not offer them as buttons. The active one
 * is marked with a rule under it and nothing else.
 *
 * Filtering happens in the browser because the whole collection is small enough
 * to send at once, which makes every change instant on a phone.
 */
export function CollectionGallery({
  styles,
  categories,
  sizes,
}: {
  styles: readonly GarmentStyle[];
  categories: readonly DesignCategory[];
  sizes: readonly Size[];
}) {
  const t = useTranslations("collection");
  const locale = useLocale() as Locale;

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<SizeId | null>(null);
  const [readyOnly, setReadyOnly] = useState(false);

  const visible = useMemo(
    () =>
      styles.filter((style) => {
        if (categoryId && style.categoryId !== categoryId) return false;
        if (sizeId) {
          const offered = style.sizes.find((size) => size.sizeId === sizeId);
          if (!offered) return false;
          if (readyOnly && !offered.inStock) return false;
        } else if (readyOnly && !style.sizes.some((size) => size.inStock)) {
          return false;
        }
        return true;
      }),
    [styles, categoryId, sizeId, readyOnly],
  );

  const hasFilters = categoryId !== null || sizeId !== null || readyOnly;

  return (
    <div className="flex flex-col">
      <div className="shell flex flex-col gap-5 pb-8">
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <FilterRow label={t("filterDesign")}>
            <FilterOption active={categoryId === null} onClick={() => setCategoryId(null)}>
              {t("all")}
            </FilterOption>
            {categories.map((category) => (
              <FilterOption
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {translate(category.name, locale)}
              </FilterOption>
            ))}
          </FilterRow>

          <FilterRow label={t("filterSize")}>
            <FilterOption active={sizeId === null} onClick={() => setSizeId(null)}>
              {t("all")}
            </FilterOption>
            {sizes.map((size) => (
              <FilterOption
                key={size.id}
                active={sizeId === size.id}
                onClick={() => setSizeId(size.id)}
                title={translate(size.measurements, locale)}
              >
                {size.label}
              </FilterOption>
            ))}
          </FilterRow>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-ink-soft">
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(event) => setReadyOnly(event.target.checked)}
              className="h-3.5 w-3.5 accent-ink"
            />
            {t("readyOnly")}
          </label>

          <div className="flex items-center gap-6">
            <p
              aria-live="polite"
              className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-faint"
            >
              {t("showing", { count: visible.length })}
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setCategoryId(null);
                  setSizeId(null);
                  setReadyOnly(false);
                }}
                className="link-underline text-[0.625rem] uppercase tracking-[0.16em]"
              >
                {t("clear")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {visible.length > 0 ? (
        <LookbookGrid>
          {visible.map((style, index) => (
            <StyleCard key={style.id} style={style} priority={index < 3} />
          ))}
        </LookbookGrid>
      ) : (
        <div className="shell flex flex-col items-start gap-6 border-y border-line py-24">
          <p className="max-w-md text-lead text-ink-soft">{t("empty")}</p>
          <Link href="/request" className={buttonClass({ size: "small" })}>
            {t("emptyAction")}
          </Link>
        </div>
      )}

    </div>
  );
}

function FilterRow({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
      {label ? <span className="eyebrow">{label}</span> : null}
      {children}
    </div>
  );
}

function FilterOption({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`border-b pb-1 text-[0.9375rem] transition-colors ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
