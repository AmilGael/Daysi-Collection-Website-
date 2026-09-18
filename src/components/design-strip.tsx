import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { translate } from "@/content";
import { Link, type Locale } from "@/i18n/routing";
import { TextLink } from "@/components/ui";
import { liveStyles } from "@/lib/live-catalog";
import { liveGallery } from "@/lib/live-gallery";
import { stripPhotos } from "@/lib/design-strip";
import { PHOTO_QUALITY } from "@/lib/images";

/** Tile heights in px, phone and from sm up; the `sizes` hint is worked out from them. */
const ROW_HEIGHT = { phone: 288, wide: 384 };
const PHOTOS = 12;

/**
 * Her work in one scrolling row, asked for by Daysi: the garment she put up
 * last first, taking turns with finished pieces from the gallery. Scroll-snap
 * does the moving, so there is no autoplay and no script; each photograph is
 * a link, which is also what makes the row reachable from the keyboard.
 */
export async function DesignStrip() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const photos = stripPhotos(liveStyles(), liveGallery(), PHOTOS);
  if (photos.length === 0) return null;

  return (
    <section aria-labelledby="design-strip-title" className="py-14 lg:py-20">
      <div className="shell mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="design-strip-title" className="eyebrow">
          {t("stripLabel")}
        </h2>
        <TextLink href="/collection">{t("collectionLink")}</TextLink>
      </div>
      <ul className="bleed-row flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] motion-safe:scroll-smooth sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {photos.map((photo) => (
          <li
            key={photo.key}
            className="relative h-72 shrink-0 snap-start overflow-hidden bg-paper-warm sm:h-96"
            style={{ aspectRatio: photo.aspect }}
          >
            <Link href={photo.href} className="group block h-full w-full">
              <Image
                src={photo.src}
                alt={translate(photo.alt, locale)}
                fill
                quality={PHOTO_QUALITY}
                sizes={`(min-width: 640px) ${Math.ceil(ROW_HEIGHT.wide * photo.aspect)}px, ${Math.ceil(ROW_HEIGHT.phone * photo.aspect)}px`}
                className="object-cover motion-safe:transition-[scale] motion-safe:duration-[600ms] motion-safe:ease-soft motion-safe:group-hover:scale-[1.03]"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
