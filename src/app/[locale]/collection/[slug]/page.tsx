import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  findCategory,
  findFabric,
  findPremiere,
  findPriceEntry,
  primaryPhoto,
  publishedStyles,
  sizes,
  translate,
} from "@/content";
import { liveStyles } from "@/lib/live-catalog";
import { routing, type Locale } from "@/i18n/routing";
import { StyleOrderPanel } from "@/components/style-order-panel";
import { LookbookGrid, StyleCard } from "@/components/style-card";
import { Tag } from "@/components/ui";
import { PHOTO_QUALITY } from "@/lib/images";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    publishedStyles().map((style) => ({ locale, slug: style.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const style = publishedStyles().find((candidate) => candidate.slug === slug);
  if (!style) return {};

  const language = locale as Locale;
  return {
    title: `${translate(style.name, language)} · Daysi Collection`,
    description: translate(style.description, language),
    openGraph: { images: [primaryPhoto(style)?.src ?? "/images/real/hero.jpg"] },
  };
}

export default async function StylePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const style = liveStyles().find((candidate) => candidate.slug === slug);
  if (!style) notFound();

  const language = (await getLocale()) as Locale;
  const t = await getTranslations("style");
  const tc = await getTranslations("common");

  const price = findPriceEntry(style.priceEntryId);
  const category = findCategory(style.categoryId);
  const fabric = price ? findFabric(price.fabricId) : undefined;
  const premiere = style.premiereId ? findPremiere(style.premiereId) : undefined;
  if (!price) notFound();

  const related = liveStyles()
    .filter((candidate) => candidate.id !== style.id && candidate.categoryId === style.categoryId)
    .slice(0, 3);

  return (
    <>
      <article className="shell grid gap-12 pb-24 pt-14 lg:grid-cols-[1.25fr_1fr] lg:gap-20 lg:pt-20">
        <div className="flex flex-col gap-5">
          {style.photos.map((photo) => (
            <div key={photo.src} className="relative aspect-3/4 overflow-hidden bg-paper-warm">
              <Image
                src={photo.src}
                alt={translate(photo.alt, language)}
                fill
                priority
                quality={PHOTO_QUALITY}
                sizes="(min-width: 1024px) 55vw, 92vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{category ? translate(category.name, language) : null}</p>
              {premiere ? (
                <Tag tone="marigold">
                  {t("partOfPremiere", { season: translate(premiere.season, language) })}
                </Tag>
              ) : null}
            </div>
            <h1 className="text-title">{translate(style.name, language)}</h1>
            <p className="text-lead text-ink-soft">{translate(style.description, language)}</p>
            <dl className="flex flex-col gap-2 border-t border-line pt-5 text-[0.875rem]">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-ink-faint">{tc("color")}</dt>
                <dd>{translate(style.color, language)}</dd>
              </div>
              {fabric ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-ink-faint">{tc("cloth")}</dt>
                  <dd>
                    {translate(fabric.name, language)}
                    <span className="text-ink-faint">
                      {" — "}
                      {translate(fabric.description, language)}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <StyleOrderPanel
            style={style}
            sizes={sizes}
            fixedPrice={price.fixedPrice}
            customizationExtra={price.customizationExtra}
            customizationNote={price.customizationNote}
          />

          <section className="flex flex-col gap-3 border-t border-line pt-8">
            <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
              {t("detailTitle")}
            </h2>
            <p className="leading-[1.75] text-ink-soft">{translate(style.detail, language)}</p>
          </section>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="reveal flex flex-col gap-8 pb-20">
          <h2 className="shell text-heading">{t("relatedTitle")}</h2>
          <LookbookGrid columns="three">
            {related.map((candidate) => (
              <StyleCard key={candidate.id} style={candidate} />
            ))}
          </LookbookGrid>
        </section>
      ) : null}
    </>
  );
}
