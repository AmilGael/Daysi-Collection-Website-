import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { business, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { ButtonLink, Prose, SectionHeading } from "@/components/ui";
import { GoogleBusiness } from "@/components/google-business";
import { PHOTO_QUALITY } from "@/lib/images";

export default async function AtelierPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("atelier");
  const th = await getTranslations("home");

  return (
    <>
      <section className="on-ink relative isolate -mt-20 flex min-h-[70svh] items-end overflow-hidden bg-ink pt-20">
        <Image
          src="/images/real/atelier-workspace.jpg"
          alt=""
          fill
          priority
          quality={PHOTO_QUALITY}
          sizes="100vw"
          className="object-cover object-[38%_28%]"
        />
        {/*
          The middle stop carries the eyebrow, and at /60 it measured 4.43:1 —
          seven hundredths short of the 4.5 a 10px label needs, which is the
          kind of miss no one finds by looking. /66 reads 5.0. Measured on the
          composited frame with the copy hidden.
        */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/66 to-ink/45" />
        {/* The workroom is a bright photograph, so the header needs its own
            ground to stay legible while it is in its light-on-dark state. */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/70 to-transparent" />
        <div className="shell relative z-10 flex max-w-2xl flex-col gap-6 pb-16 pt-28">
          {/* Full paper over a photograph; see the note in premieres/page.tsx. */}
          <p className="eyebrow text-paper">{business.neighborhood}</p>
          <h1 className="text-display text-paper">{t("title")}</h1>
          <p className="text-lead text-paper">{t("lead")}</p>
        </div>
      </section>

      {/*
        Her story, whole. This is Daysi's bio as she gave it, word for word,
        broken only at its natural sentence boundaries — the shortened version
        it replaces read as a caption where she had written a life. The craft
        and heritage panels that used to follow are gone for the same reason:
        every line they carried is in these paragraphs now, and a page should
        not quote her twice.
      */}
      <section className="shell reveal grid gap-14 py-24 lg:grid-cols-2 lg:gap-24">
        <div className="flex flex-col gap-7">
          <SectionHeading index="01" title={th("storyTitle")} />
          <Prose>
            <p>{t("bio1")}</p>
            <p>{t("bio2")}</p>
            <p>{t("bio3")}</p>
            <p>{t("bio4")}</p>
          </Prose>
        </div>
        <div className="flex flex-col gap-10">
          <div className="relative aspect-4/5 overflow-hidden bg-paper-warm">
            <Image
              src="/images/real/daysi-portrait-standing.jpg"
              alt={t("portraitAlt")}
              fill
              quality={PHOTO_QUALITY}
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="shell reveal grid gap-14 py-24 lg:grid-cols-2 lg:items-center lg:gap-24">
        <div className="relative aspect-4/3 overflow-hidden bg-paper-warm">
          <Image
            src="/images/real/atelier-shelves.jpg"
            alt=""
            fill
            quality={PHOTO_QUALITY}
            sizes="(min-width: 1024px) 45vw, 90vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-7">
          <SectionHeading index="02" title={t("visitTitle")} />
          <Prose>
            <p>{t("visitBody")}</p>
            <p>{translate(business.addressNote, language)}</p>
          </Prose>
          <ButtonLink href="/appointments" className="w-fit">
            {th("heroPrimary")}
          </ButtonLink>
        </div>
      </section>

      <GoogleBusiness />
    </>
  );
}
