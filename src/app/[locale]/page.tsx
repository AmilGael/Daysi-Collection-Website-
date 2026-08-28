import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  premieres,
  services,
  translate,
  upcomingPremiere,
} from "@/content";
import { liveStyles } from "@/lib/live-catalog";
import { liveAlterations } from "@/lib/live-pricing";
import { SiteNoticeBar } from "@/components/site-notice";
import { Link, type Locale } from "@/i18n/routing";
import { ButtonLink, SectionHeading, Tag, TextLink } from "@/components/ui";
import { LookbookGrid, StyleCard } from "@/components/style-card";
import { GoogleBusiness } from "@/components/google-business";
import { formatMoney } from "@/lib/money";
import { PHOTO_QUALITY } from "@/lib/images";

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
 * One photograph, one line of type, one thing to do. Stella Jean's hero is a
 * picture and a single line — no label above it, no paragraph beneath it, and
 * not two buttons competing for the same click.
 */
async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="on-ink relative isolate -mt-20 flex min-h-[94svh] items-end overflow-hidden bg-ink pt-20">
      <Image
        src="/images/real/hero.jpg"
        alt=""
        fill
        priority
        quality={PHOTO_QUALITY}
        sizes="100vw"
        className="object-cover object-[72%_18%]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/60 to-transparent" />

      <div className="shell relative z-10 pb-24 pt-32">
        <div className="flex max-w-2xl flex-col gap-8">
          <h1 className="text-display text-balance text-paper">{t("heroTitle")}</h1>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-paper-soft">
            {t("heroLine")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-10 gap-y-5">
            <ButtonLink href="/appointments" tone="marigold">
              {t("heroPrimary")}
            </ButtonLink>
            <TextLink href="/collection" tone="paper">
              {t("heroSecondary")}
            </TextLink>
          </div>
        </div>
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
      <div className="shell flex overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <h2 className="text-title text-balance">{t("storyTitle")}</h2>
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
        <p className="mx-auto max-w-3xl text-center font-display text-[clamp(1.75rem,3.4vw,2.85rem)] leading-[1.25] text-balance">
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
        {services.map((service, index) => (
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
              <span className="font-display text-[0.9375rem] tabular-nums text-paper-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
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
        <h2 className="text-title text-balance">{t("alterationsTitle")}</h2>
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
          <h2 className="text-title text-balance text-paper">{t("pricesTitle")}</h2>
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
  const premiere = upcomingPremiere(new Date()) ?? premieres[0];
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
          <h2 className="text-title text-balance">
            {translate(premiere.title, locale)}
          </h2>
          <p className="eyebrow">{translate(premiere.season, locale)}</p>
          <p className="leading-[1.8] text-ink-soft">{translate(premiere.story, locale)}</p>
          <div className="flex flex-wrap gap-2">
            <Tag tone="marigold">{tp("pieces", { count: premiere.piecesPlanned })}</Tag>
            <Tag>{tp("edition", { count: premiere.editionSize })}</Tag>
          </div>
          <TextLink href="/premieres">{t("premiereLink")}</TextLink>
        </div>
      </div>
    </section>
  );
}
