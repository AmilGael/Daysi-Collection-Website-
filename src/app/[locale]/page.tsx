import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { premiereListing, services, translate } from "@/content";
import { liveStyles } from "@/lib/live-catalog";
import { liveAlterations } from "@/lib/live-pricing";
import { SiteNoticeBar } from "@/components/site-notice";
import { Link, type Locale } from "@/i18n/routing";
import { ButtonLink, SectionHeading, Tag, TextLink } from "@/components/ui";
import { LookbookGrid, StyleCard } from "@/components/style-card";
import { GoogleBusiness } from "@/components/google-business";
import { formatMoney } from "@/lib/money";
import { PHOTO_QUALITY } from "@/lib/images";
import { HERO_BACKDROP, HERO_PLATES } from "@/content/photographs";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <SiteNoticeBar />
      <TrustStrip />
      <Story />
      <BrandPromise />
      <Services />
      <FeaturedCollection />
      <Alterations />
      <PricePromise />
      <NextPremiere />
      <GoogleBusiness />
    </>
  );
}

/**
 * The type on ink, then the three pictures asked for by name, lined up in one
 * row: the yellow studio sitting that opened the first version of this site,
 * the Frutera set under the plaster arches, and the October 2019 cover — the
 * two yellows on the outside, the creme between them.
 *
 * Each plate keeps its file's own proportions and nothing is painted over any
 * of them. Two of the three are things somebody composed — a cover with its
 * masthead, a portrait with its ground — and cropping either cuts a picture
 * that was already laid out. The tops align and the bottoms fall where each
 * file's height puts them, which is what a row of prints on a wall does.
 */
async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="on-ink relative -mt-20 overflow-hidden bg-ink pb-24 text-paper lg:pb-32">
      {/*
        A woven ground behind the ink, asked for by the owner: near-black cloth
        with a few marigold threads, dark enough that the type never fights it.
        The gradient pins the top and bottom back to flat ink, so the header
        fade-in and the plates row both land on a quiet ground.
      */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src={HERO_BACKDROP}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={70}
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/15 to-ink/85" />
      </div>

      {/*
        The type is centred — headline, its line, and the two buttons on one
        axis — with pt-32 clearing the 80px transparent header and the band it
        fades through.
      */}
      <div className="shell relative flex flex-col gap-8 pb-14 pt-32 lg:pt-36">
        <div className="mx-auto flex w-full max-w-[50rem] flex-col items-center gap-8 text-center">
          {/* 17ch, not tighter: at the ramp's top the Spanish headline needs
              the width to hold two lines, and English stays at two anyway. */}
          <h1 className="hero-display max-w-[17ch] text-display text-paper">{t("heroTitle")}</h1>
          {/* paper-soft over the texture is measured, not assumed: the
              brightest pixel in the whole weave at the gradient's lightest
              stop composites to 4.63:1 against it, and the line actually sits
              where the veil is heavier (~7.5:1). Lighten the texture or
              gradient and this measurement is void — redo it. */}
          <p className="max-w-lg text-[1.125rem] leading-relaxed text-paper-soft">
            {t("heroLine")}
          </p>
          <div className="mt-2 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row sm:justify-center sm:gap-5">
            <ButtonLink
              href="/appointments"
              tone="marigold"
              size="large"
              className="glow-marigold w-full hover:-translate-y-[1.5px] sm:w-auto"
            >
              {t("heroPrimary")}
            </ButtonLink>
            <ButtonLink
              href="/collection"
              tone="ghost"
              size="large"
              className="w-full hover:-translate-y-[1.5px] sm:w-auto"
            >
              {t("heroSecondary")}
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="shell relative grid gap-10 sm:grid-cols-3 sm:items-start sm:gap-6 lg:gap-10">
        {HERO_PLATES.map((plate, index) => (
          <figure key={plate.src} className="flex flex-col gap-4">
            <div className="relative overflow-hidden" style={{ aspectRatio: plate.aspect }}>
              <Image
                src={plate.src}
                alt={t(plate.altKey)}
                fill
                priority={index === 0}
                quality={PHOTO_QUALITY}
                sizes="(min-width: 640px) 31vw, 92vw"
                className="object-cover"
              />
            </div>
            <figcaption className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-paper-soft">
              {t(plate.captionKey)}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** The five things worth knowing before scrolling, borrowed from Alts' ticker. */
async function TrustStrip() {
  const t = await getTranslations("home.trust");
  const items = ["one", "two", "three", "four", "five"] as const;

  return (
    <section className="border-b border-line bg-paper-warm">
      <div className="shell flex flex-wrap justify-center gap-y-2 py-4 md:flex-nowrap md:justify-start md:overflow-x-auto md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <p
            key={item}
            className={`shrink-0 whitespace-nowrap px-6 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-ink-faint first:pl-0 ${
              index > 0 ? "border-l border-line" : ""
            }`}
          >
            {t(item)}
          </p>
        ))}
      </div>
    </section>
  );
}

/**
 * Deliberately off-balance: the photograph takes five columns and the text
 * seven, sitting low against it. An even split down the middle is the layout
 * you get when nobody chose one.
 */
async function Story() {
  const t = await getTranslations("home");

  return (
    <section className="shell reveal grid gap-12 py-24 lg:grid-cols-12 lg:gap-16 lg:py-36">
      <div className="relative aspect-4/5 overflow-hidden bg-paper-warm lg:col-span-5">
        <Image
          src="/images/real/daysi-portrait.jpg"
          alt={t("storyPortraitAlt")}
          fill
          quality={PHOTO_QUALITY}
          sizes="(min-width: 1024px) 40vw, 90vw"
          // The file is already cut to 4:5, so nothing here is deciding
          // where her head sits — the crop was chosen, not defaulted.
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-7 lg:col-span-6 lg:col-start-7 lg:justify-end lg:pb-6">
        <p className="rule-label">
          <span>01</span>
          <span>{t("storyLabel")}</span>
        </p>
        <h2 className="text-title">{t("storyTitle")}</h2>
        <p className="text-lead text-ink-soft">{t("storyLead")}</p>
        <p className="max-w-xl leading-[1.8] text-ink-soft">{t("storyBody")}</p>
        <TextLink href="/atelier">{t("storyLink")}</TextLink>
      </div>
    </section>
  );
}

/**
 * The brand promise, alone on the page at display size. Alts gives its one
 * sentence a whole section and no competition; this is the same move in
 * Daysi's words.
 */
async function BrandPromise() {
  const t = await getTranslations("home");

  return (
    <section className="reveal border-y border-line bg-paper-warm py-28 md:py-36">
      <div className="shell">
        <p className="mx-auto max-w-3xl text-center font-display text-[clamp(1.75rem,3.4vw,2.85rem)] leading-[1.25]">
          {t("promise")}
        </p>
      </div>
    </section>
  );
}

/**
 * The three services as photograph tiles — Alts' benefit grid, which lets the
 * work do the arguing instead of an icon.
 */
async function Services() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;

  return (
    <section className="reveal py-24 lg:py-32">
      <div className="shell flex flex-col gap-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading index="02" title={t("servicesTitle")} />
          <TextLink href="/services">{t("servicesLink")}</TextLink>
        </div>
      </div>
      <div className="mt-12 grid gap-px border-y border-line bg-line md:grid-cols-3">
        {services.map((service) => (
          <Link
            key={service.id}
            href="/services"
            className="on-ink group relative aspect-4/5 overflow-hidden bg-ink"
          >
            <Image
              src={service.image}
              alt=""
              fill
              quality={PHOTO_QUALITY}
              sizes="(min-width: 768px) 34vw, 100vw"
              className="photo-hover object-cover opacity-85 transition-[transform,opacity] duration-[600ms] ease-soft group-hover:scale-[1.04] group-hover:opacity-100"
            />
            <div className="image-veil absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-8">
              <h3 className="font-display text-[1.6rem] leading-tight text-paper">
                {translate(service.name, locale)}
              </h3>
              <p className="max-w-xs text-[0.875rem] leading-relaxed text-paper-soft">
                {translate(service.promise, locale)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function FeaturedCollection() {
  const t = await getTranslations("home");
  const featured = liveStyles().slice(0, 3);

  return (
    <section className="reveal py-24 lg:py-32">
      <div className="shell mb-12 flex flex-wrap items-end justify-between gap-6">
        <SectionHeading index="03" title={t("collectionTitle")} lead={t("collectionLead")} />
        <TextLink href="/collection">{t("collectionLink")}</TextLink>
      </div>
      <LookbookGrid columns="three">
        {featured.map((style) => (
          <StyleCard key={style.id} style={style} />
        ))}
      </LookbookGrid>
    </section>
  );
}

async function Alterations() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const highlights = liveAlterations().slice(0, 5);

  return (
    <section className="shell reveal grid gap-12 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32">
      <div className="flex flex-col gap-7 lg:col-span-6 lg:order-2">
        <p className="rule-label">
          <span>04</span>
          <span>{t("alterationsLabel")}</span>
        </p>
        <h2 className="text-title">{t("alterationsTitle")}</h2>
        <p className="text-lead text-ink-soft">{t("alterationsLead")}</p>
        <dl className="mt-2 flex flex-col">
          {highlights.map((alteration) => (
            <div
              key={alteration.id}
              className="flex items-baseline justify-between gap-6 border-b border-line py-3"
            >
              <dt className="text-[0.9375rem] text-ink-soft">
                {translate(alteration.name, locale)}
              </dt>
              <dd className="shrink-0 text-[0.9375rem] tabular-nums">
                {formatMoney(alteration.fixedPrice, locale)}
              </dd>
            </div>
          ))}
        </dl>
        <ButtonLink href="/alterations" className="mt-2 w-fit">
          {t("alterationsLink")}
        </ButtonLink>
      </div>
      <div className="relative aspect-4/5 overflow-hidden bg-paper-warm lg:col-span-5 lg:order-1">
        <Image
          src="/images/real/workroom.jpg"
          alt=""
          fill
          quality={PHOTO_QUALITY}
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}

async function PricePromise() {
  const t = await getTranslations("home");

  return (
    <section className="on-ink reveal border-y border-line bg-ink py-24 text-paper lg:py-28">
      <div className="shell grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <h2 className="text-title text-paper">{t("pricesTitle")}</h2>
          <p className="max-w-xl text-lead text-paper-soft">{t("pricesLead")}</p>
        </div>
        <div className="lg:col-span-4 lg:col-start-9">
          <ButtonLink href="/prices" tone="ghost">
            {t("pricesLink")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

async function NextPremiere() {
  const t = await getTranslations("home");
  const tp = await getTranslations("premieres");
  const locale = (await getLocale()) as Locale;
  // Between seasons there is no next premiere written down yet; the section
  // keeps the latest season's photograph and says the next one is coming.
  const { next, latest } = premiereListing(new Date());
  const premiere = next ?? latest;
  if (!premiere) return null;

  return (
    <section className="reveal py-24 lg:py-32">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div className="relative aspect-16/10 overflow-hidden bg-paper-warm lg:col-span-7">
          <Image
            src={premiere.coverImage}
            alt=""
            fill
            quality={PHOTO_QUALITY}
            sizes="(min-width: 1024px) 55vw, 90vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4 lg:col-start-9">
          <p className="rule-label">
            <span>05</span>
            <span>{t("premiereTitle")}</span>
          </p>
          <h2 className="text-title">
            {next ? translate(next.title, locale) : tp("betweenTitle")}
          </h2>
          {next ? <p className="eyebrow">{translate(next.season, locale)}</p> : null}
          <p className="leading-[1.8] text-ink-soft">
            {next ? translate(next.story, locale) : tp("betweenLead")}
          </p>
          {next ? (
            <div className="flex flex-wrap gap-2">
              <Tag tone="marigold">{tp("pieces", { count: next.piecesPlanned })}</Tag>
              <Tag>{tp("edition", { count: next.editionSize })}</Tag>
            </div>
          ) : null}
          <TextLink href="/premieres">{t("premiereLink")}</TextLink>
        </div>
      </div>
    </section>
  );
}
