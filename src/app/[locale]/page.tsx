import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  business,
  premieres,
  publishedStyles,
  services,
  translate,
  upcomingPremiere,
} from "@/content";
import { Link, type Locale } from "@/i18n/routing";
import { ButtonLink, SectionHeading, Tag } from "@/components/ui";
import { StyleCard } from "@/components/style-card";
import { GoogleBusiness } from "@/components/google-business";
import { alterationServices } from "@/content";
import { formatMoney } from "@/lib/money";

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
      <TrustStrip />
      <Story />
      <Services />
      <FeaturedCollection />
      <PricePromise />
      <Alterations />
      <NextPremiere />
      <GoogleBusiness />
    </>
  );
}

/**
 * One photograph, one line of type over it, one action. The restraint is
 * borrowed from Stella Jean; the warmth comes from the photograph itself.
 */
async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="relative isolate -mt-20 flex min-h-[92svh] items-end overflow-hidden bg-ink pt-20">
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[68%_center]"
      />
      {/* Keeps the type legible without flattening the photograph behind it. */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/60 to-transparent" />

      <div className="shell relative z-10 pb-20 pt-32 sm:pb-28">
        <div className="flex max-w-2xl flex-col gap-8">
          <p className="eyebrow text-paper/70">{t("eyebrow")}</p>
          <h1 className="text-display text-balance text-paper">{t("heroTitle")}</h1>
          <p className="max-w-xl text-lead text-pretty text-paper/75">{t("heroLine")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/appointments" tone="marigold">
              {t("heroPrimary")}
            </ButtonLink>
            <ButtonLink href="/collection" tone="ghost">
              {t("heroSecondary")}
            </ButtonLink>
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
      <div className="shell flex gap-x-10 gap-y-3 overflow-x-auto py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <p
            key={item}
            className="flex shrink-0 items-center gap-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink-faint"
          >
            <span className="h-1 w-1 rounded-full bg-marigold" aria-hidden />
            {t(item)}
          </p>
        ))}
      </div>
    </section>
  );
}

async function Story() {
  const t = await getTranslations("home");

  return (
    <section className="shell reveal grid gap-14 py-28 lg:grid-cols-2 lg:items-center lg:gap-24">
      <div className="relative aspect-4/5 overflow-hidden bg-paper-warm lg:aspect-4/5">
        <Image
          src="/images/atelier/sewing.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 45vw, 90vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-7">
        <SectionHeading
          eyebrow={t("promise")}
          title={t("storyTitle")}
          lead={t("storyLead")}
        />
        <p className="max-w-xl leading-[1.75] text-ink-soft">{t("storyBody")}</p>
        <Link href="/atelier" className="link-underline w-fit text-sm font-medium">
          {t("storyLink")} →
        </Link>
      </div>
    </section>
  );
}

/**
 * The three services as photograph tiles rather than icon cards — Alts' pattern,
 * which lets the work do the arguing.
 */
async function Services() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;

  return (
    <section className="reveal bg-ink py-28 text-paper">
      <div className="shell flex flex-col gap-14">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("servicesTitle")}
          tone="paper"
        />
        <div className="grid gap-5 md:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href="/services"
              className="group relative aspect-4/5 overflow-hidden"
            >
              <Image
                src={service.image}
                alt=""
                fill
                sizes="(min-width: 768px) 32vw, 90vw"
                className="object-cover transition-transform duration-[1.1s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.05]"
              />
              <div className="image-veil absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-7">
                <h3 className="text-heading text-paper">{translate(service.name, locale)}</h3>
                <p className="text-sm leading-relaxed text-paper/70">
                  {translate(service.promise, locale)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

async function FeaturedCollection() {
  const t = await getTranslations("home");
  const featured = publishedStyles().slice(0, 4);

  return (
    <section className="shell reveal flex flex-col gap-12 py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("collectionTitle")}
          lead={t("collectionLead")}
        />
        <Link href="/collection" className="link-underline text-sm font-medium">
          {t("collectionLink")} →
        </Link>
      </div>
      <div className="grid gap-x-5 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
        {featured.map((style) => (
          <StyleCard key={style.id} style={style} />
        ))}
      </div>
    </section>
  );
}

async function PricePromise() {
  const t = await getTranslations("home");

  return (
    <section className="reveal bg-paper-warm py-28">
      <div className="shell flex flex-col items-center gap-8 text-center">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("pricesTitle")}
          lead={t("pricesLead")}
          align="center"
        />
        <ButtonLink href="/prices" tone="outline">
          {t("pricesLink")}
        </ButtonLink>
      </div>
    </section>
  );
}

async function Alterations() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const highlights = alterationServices.slice(0, 5);

  return (
    <section className="shell reveal grid gap-14 py-28 lg:grid-cols-2 lg:items-center lg:gap-24">
      <div className="flex flex-col gap-7 lg:order-2">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("alterationsTitle")}
          lead={t("alterationsLead")}
        />
        <dl className="flex flex-col">
          {highlights.map((alteration) => (
            <div
              key={alteration.id}
              className="flex items-baseline justify-between gap-6 border-b border-line py-3.5"
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
        <ButtonLink href="/alterations" className="w-fit">
          {t("alterationsLink")}
        </ButtonLink>
      </div>
      <div className="relative aspect-4/5 overflow-hidden bg-paper-warm lg:order-1">
        <Image
          src="/images/atelier/hemming.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 45vw, 90vw"
          className="object-cover"
        />
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
    <section className="reveal bg-ink py-28 text-paper">
      <div className="shell grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-20">
        <div className="relative aspect-16/10 overflow-hidden">
          <Image
            src={premiere.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 55vw, 90vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-7">
          <SectionHeading
            eyebrow={t("premiereTitle")}
            title={`${translate(premiere.title, locale)} · ${translate(premiere.season, locale)}`}
            lead={t("premiereLead")}
            tone="paper"
          />
          <div className="flex flex-wrap gap-2">
            <Tag tone="marigold">{tp("pieces", { count: premiere.piecesPlanned })}</Tag>
            <Tag tone="outline">{tp("edition", { count: premiere.editionSize })}</Tag>
          </div>
          <p className="max-w-lg leading-[1.75] text-paper/70">
            {translate(premiere.story, locale)}
          </p>
          <ButtonLink href="/premieres" tone="ghost" className="w-fit">
            {t("premiereLink")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
