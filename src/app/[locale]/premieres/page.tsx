import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { premieres, stylesInPremiere, translate, upcomingPremiere } from "@/content";
import type { Locale } from "@/i18n/routing";
import { SectionHeading, Tag } from "@/components/ui";
import { LookbookGrid, StyleCard } from "@/components/style-card";
import { PremiereSignup } from "@/components/premiere-signup";
import { PHOTO_QUALITY } from "@/lib/images";

export default async function PremieresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("premieres");

  const now = new Date();
  const next = upcomingPremiere(now);
  const past = premieres.filter((premiere) => premiere.id !== next?.id);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));

  return (
    <>
      {next ? (
        <section className="relative isolate -mt-20 flex min-h-[86svh] items-end overflow-hidden bg-ink pt-20">
          <Image
            src={next.coverImage}
            alt=""
            fill
            priority
            quality={PHOTO_QUALITY}
            sizes="100vw"
            className="object-cover object-[65%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/92 via-ink/55 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/60 to-transparent" />
          <div className="shell relative z-10 flex max-w-2xl flex-col gap-7 pb-20 pt-28">
            <p className="eyebrow text-paper/70">
              {t("upcoming")} · {translate(next.season, language)}
            </p>
            <h1 className="text-display text-paper">{translate(next.title, language)}</h1>
            <p className="max-w-xl text-lead text-paper/75">{translate(next.story, language)}</p>
            <div className="flex flex-wrap gap-2">
              <Tag tone="marigold">{t("pieces", { count: next.piecesPlanned })}</Tag>
              <Tag tone="outline">{t("edition", { count: next.editionSize })}</Tag>
            </div>
            <dl className="flex flex-wrap gap-x-10 gap-y-3 border-t border-paper/20 pt-6 text-paper/75">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-paper/45">
                  {t("revealOn")}
                </dt>
                <dd className="mt-1">{formatDate(next.revealDate)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-paper/45">
                  {t("releaseOn")}
                </dt>
                <dd className="mt-1">{formatDate(next.releaseDate)}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      <section className="shell reveal grid gap-14 py-24 lg:grid-cols-2 lg:gap-24">
        <div className="flex flex-col gap-6">
          <SectionHeading title={t("title")} lead={t("lead")} />
          {next ? (
            <p className="leading-[1.75] text-ink-soft">
              {translate(next.inspiration, language)}
            </p>
          ) : null}
        </div>
        {next ? (
          <div className="flex flex-col gap-6 bg-paper-warm p-8">
            <div className="flex flex-col gap-3">
              <h2 className="text-heading">{t("signupTitle")}</h2>
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{t("signupLead")}</p>
            </div>
            <PremiereSignup premiereId={next.id} revealDate={next.revealDate} />
          </div>
        ) : null}
      </section>

      {next && stylesInPremiere(next).length > 0 ? (
        <section className="reveal flex flex-col gap-8 pb-24">
          <h2 className="shell text-heading">{t("included")}</h2>
          <LookbookGrid>
            {stylesInPremiere(next).map((style) => (
              <StyleCard key={style.id} style={style} />
            ))}
          </LookbookGrid>
        </section>
      ) : null}

      {past.map((premiere) => (
        <section key={premiere.id} className="reveal border-t border-line py-24">
          <div className="flex flex-col gap-12">
            <div className="shell flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                eyebrow={`${t("released")} · ${formatDate(premiere.releaseDate)}`}
                title={`${translate(premiere.title, language)} · ${translate(premiere.season, language)}`}
                lead={translate(premiere.story, language)}
              />
              <div className="flex flex-wrap gap-2">
                <Tag>{t("pieces", { count: premiere.piecesPlanned })}</Tag>
                <Tag>{t("edition", { count: premiere.editionSize })}</Tag>
              </div>
            </div>
            <LookbookGrid>
              {stylesInPremiere(premiere).map((style) => (
                <StyleCard key={style.id} style={style} />
              ))}
            </LookbookGrid>
          </div>
        </section>
      ))}
    </>
  );
}
