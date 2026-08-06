import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  findCategory,
  findPriceEntry,
  primaryPhoto,
  translate,
  type GarmentStyle,
} from "@/content";
import { formatMoney } from "@/lib/money";
import { Link, type Locale } from "@/i18n/routing";

/**
 * One card in the gallery: photograph, name, the sizes it is cut in, and the
 * fixed price read from the price list. The whole card is the link, so it is a
 * comfortable target on a phone.
 */
export function StyleCard({ style, priority = false }: { style: GarmentStyle; priority?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;

  const photo = primaryPhoto(style);
  const price = findPriceEntry(style.priceEntryId);
  const category = findCategory(style.categoryId);

  return (
    <Link href={`/collection/${style.slug}`} className="group flex flex-col gap-4">
      <div className="relative aspect-3/4 overflow-hidden bg-paper-warm">
        {photo ? (
          <Image
            src={photo.src}
            alt={translate(photo.alt, locale)}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 88vw"
            className="object-cover transition-transform duration-[1.1s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="absolute left-4 top-4 flex gap-2">
          {style.sizes.some((size) => size.inStock) ? null : (
            <span className="rounded-full bg-paper/90 px-3 py-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-ink">
              {t("madeToOrder")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          {category ? translate(category.name, locale) : null}
        </p>
        <h3 className="text-heading leading-tight">{translate(style.name, locale)}</h3>
        <p className="text-sm text-ink-faint">{translate(style.color, locale)}</p>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <span className="text-[0.9375rem]">
            {price ? formatMoney(price.fixedPrice, locale) : null}
          </span>
          <span className="text-[0.6875rem] uppercase tracking-[0.16em] text-ink-faint">
            {style.sizes.map((size) => size.sizeId.toUpperCase()).join(" · ")}
          </span>
        </div>
      </div>
    </Link>
  );
}
