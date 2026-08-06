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
import { StyleCard } from "./style-card";
import { buttonClass } from "./ui";

/**
 * The gallery with its two filters, by design and by size, plus a switch for
 * what is ready to wear right now. Filtering happens here rather than on the
 * server because the whole collection is small enough to send at once, which
 * makes every filter change instant on a phone.
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
  const tc = useTranslations("common");
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
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 border-y border-line py-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <FilterRow label={t("filterDesign")}>
            <FilterChip active={categoryId === null} onClick={() => setCategoryId(null)}>
              {t("all")}
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {translate(category.name, locale)}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label={t("filterSize")}>
            <FilterChip active={sizeId === null} onClick={() => setSizeId(null)}>
              {t("all")}
            </FilterChip>
            {sizes.map((size) => (
              <FilterChip
                key={size.id}
                active={sizeId === size.id}
                onClick={() => setSizeId(size.id)}
                title={translate(size.measurements, locale)}
              >
                {size.label}
              </FilterChip>
            ))}
          </FilterRow>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-ink-soft">
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(event) => setReadyOnly(event.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            {t("readyOnly")}
          </label>

          <div className="flex items-center gap-5">
            <p aria-live="polite" className="text-[0.8125rem] text-ink-faint">
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
                className="link-underline text-[0.8125rem] font-medium"
              >
                {t("clear")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-x-5 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((style, index) => (
            <StyleCard key={style.id} style={style} priority={index < 3} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-6 bg-paper-warm px-8 py-16 sm:items-center sm:text-center">
          <p className="max-w-md text-lead text-ink-soft">{t("empty")}</p>
          <Link href="/request" className={buttonClass({ size: "small" })}>
            {t("emptyAction")}
          </Link>
        </div>
      )}

      <p className="text-[0.75rem] leading-relaxed text-ink-faint">{tc("placeholderImagery")}</p>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
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
      className={`rounded-full border px-4 py-1.5 text-[0.8125rem] transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-line text-ink-soft hover:border-ink/50 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
