import { Children } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { primaryPhoto, translate, type PricedStyle } from "@/content";
import { formatMoney } from "@/lib/money";
import { promotedPrice, promotionBadge } from "@/lib/promotions";
import { Link, type Locale } from "@/i18n/routing";
import { PHOTO_QUALITY } from "@/lib/images";
import { StylePhotoSwiper } from "./style-photo-swiper";
import { Tag } from "./ui";

/**
 * One piece in the lookbook.
 *
 * The photograph runs to the edges of its cell with no card chrome around it,
 * and the caption underneath is set small and quiet — the garment argues for
 * itself, and the type stays out of its way. Everything the PRD requires on a
 * card is still here (name, colour, sizes, fixed price); it is just set at the
 * weight of a printed catalogue line rather than a product tile.
 */
/**
 * The card takes its price already worked out (`withPrices` on the server),
 * the garment's own when Daysi set one, with the promotion that reaches it
 * today: it renders inside client components, which must never reach for
 * the files the live price list is read from. A promotion shows as the
 * lowered price with the old one struck after it, and a tag on the photo.
 */
export function StyleCard({ style, priority = false }: { style: PricedStyle; priority?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("collection");
  const tc = useTranslations("common");

  const photo = primaryPhoto(style);
  const shown = style.price ? promotedPrice(style.price) : null;
  const href = `/collection/${style.slug}`;

  const badge = shown?.promotion ? (
    <span className="pointer-events-none absolute left-3 top-3 z-10">
      <Tag tone="marigold">{promotionBadge(shown.promotion, locale)}</Tag>
    </span>
  ) : null;

  // A second photograph makes the picture area a swipeable strip; the strip's
  // slides are links of their own, so the card cannot wrap everything in one
  // anchor the way the single-photograph card does.
  const swipes = style.photos.length > 1;

  const caption = (
    <div className="flex flex-col gap-1 px-5 py-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-[1.0625rem] leading-tight">
          {translate(style.name, locale)}
        </h3>
        <span className="shrink-0 text-[0.875rem] tabular-nums">
          {shown ? formatMoney(shown.amount, locale) : null}
          {shown?.listAmount !== undefined ? (
            <s className="ml-2 text-ink-faint">
              <span className="sr-only">{tc("wasPrice")} </span>
              {formatMoney(shown.listAmount, locale)}
            </s>
          ) : null}
        </span>
      </div>
      <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
        {translate(style.color, locale)}
        <span className="px-2 text-ink-faint">/</span>
        {/* A size with no pieces left is not on offer ready-made, so it is not listed. */}
        {style.sizes.some((size) => size.count !== 0)
          ? style.sizes
              .filter((size) => size.count !== 0)
              .map((size) => size.sizeId.toUpperCase())
              .join(" ")
          : tc("soldOut")}
      </p>
    </div>
  );

  if (swipes) {
    return (
      <div className="flex flex-col border-l border-t border-line bg-paper">
        <div className="relative">
          <StylePhotoSwiper
            href={href}
            priority={priority}
            photos={style.photos.map((item) => ({
              src: item.src,
              alt: translate(item.alt, locale),
            }))}
            nextLabel={t("nextPhoto")}
            previousLabel={t("previousPhoto")}
          />
          {badge}
        </div>
        <Link href={href} className="group">
          {caption}
        </Link>
      </div>
    );
  }

  return (
    <Link href={href} className="group flex flex-col border-l border-t border-line bg-paper">
      <div className="relative aspect-3/4 overflow-hidden bg-paper-warm">
        {photo ? (
          <Image
            src={photo.src}
            alt={translate(photo.alt, locale)}
            fill
            priority={priority}
            quality={PHOTO_QUALITY}
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="photo-hover object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03]"
          />
        ) : null}
        {badge}
      </div>
      {caption}
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
  // The hairlines are drawn by the cards themselves — each carries a top and
  // left border, and the wrapper clips the outermost pair away with a one-pixel
  // shift. A line-coloured background under a pixel gap would do the same with
  // less code, but it paints every EMPTY cell as a solid grey block the moment
  // a row is short: ten pieces in three columns left two garment-sized slabs
  // at the end of the collection.
  const count = Children.count(children);

  if (count === 1) {
    return (
      <div className="border-y border-line">
        <div className="mx-auto w-full max-w-sm border-x border-line [&>*]:border-0">
          {children}
        </div>
      </div>
    );
  }

  const layout =
    count === 2
      ? "sm:grid-cols-2"
      : columns === "three"
        ? "md:grid-cols-3"
        : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="overflow-hidden border-y border-line">
      <div className={`-ml-px -mt-px grid ${layout}`}>{children}</div>
    </div>
  );
}
