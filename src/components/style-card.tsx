import { Children } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { findPriceEntry, primaryPhoto, translate, type GarmentStyle } from "@/content";
import { formatMoney } from "@/lib/money";
import { Link, type Locale } from "@/i18n/routing";

/**
 * One piece in the lookbook.
 *
 * The photograph runs to the edges of its cell with no card chrome around it,
 * and the caption underneath is set small and quiet — the garment argues for
 * itself, and the type stays out of its way. Everything the PRD requires on a
 * card is still here (name, colour, sizes, fixed price); it is just set at the
 * weight of a printed catalogue line rather than a product tile.
 */
export function StyleCard({ style, priority = false }: { style: GarmentStyle; priority?: boolean }) {
  const locale = useLocale() as Locale;

  const photo = primaryPhoto(style);
  const price = findPriceEntry(style.priceEntryId);

  return (
    <Link href={`/collection/${style.slug}`} className="group flex flex-col bg-paper">
      <div className="relative aspect-3/4 overflow-hidden bg-paper-warm">
        {photo ? (
          <Image
            src={photo.src}
            alt={translate(photo.alt, locale)}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03]"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1 px-5 py-5 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-[1.0625rem] leading-tight">
            {translate(style.name, locale)}
          </h3>
          <span className="shrink-0 text-[0.875rem] tabular-nums">
            {price ? formatMoney(price.fixedPrice, locale) : null}
          </span>
        </div>
        <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
          {translate(style.color, locale)}
          <span className="px-2 text-line">/</span>
          {style.sizes.map((size) => size.sizeId.toUpperCase()).join(" ")}
        </p>
      </div>
    </Link>
  );
}

/**
 * The grid the cards sit in: full-bleed, three across, separated by a hairline
 * rather than floated apart on a gap. Borrowed from Stella Jean, where the
 * homepage below the hero simply *is* the lookbook.
 */
export function LookbookGrid({
  children,
  columns = "gallery",
}: {
  children: React.ReactNode;
  /**
   * `gallery` steps up to three across and is right for a long run of pieces.
   * `three` stays three across from tablet up, for the places that show exactly
   * three and would otherwise leave one stranded on its own row.
   */
  columns?: "gallery" | "three";
}) {
  // The hairlines come from a one-pixel gap over a line-coloured background,
  // so the grid must never have more columns than pieces — an empty cell would
  // show as a grey block rather than as nothing at all.
  const count = Children.count(children);

  if (count === 1) {
    return (
      <div className="border-y border-line">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    );
  }

  const layout =
    count === 2
      ? "sm:grid-cols-2"
      : columns === "three"
        ? "md:grid-cols-3"
        : "sm:grid-cols-2 xl:grid-cols-3";

  return <div className={`grid gap-px border-y border-line bg-line ${layout}`}>{children}</div>;
}
