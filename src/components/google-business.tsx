import { getLocale, getTranslations } from "next-intl/server";
import { business, googleProfileVerified, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { ExternalButtonLink, SectionHeading } from "./ui";

/**
 * Google is how Daysi's clients actually find her, so the listing and the site
 * are shown together rather than the site pretending Google does not exist.
 *
 * Until her profile is connected, the rating is not displayed at all — a star
 * count nobody has earned yet would be a lie on the most trusted part of the
 * page. `googleProfileVerified` in content/business.ts is the single switch.
 */
export async function GoogleBusiness() {
  const t = await getTranslations("google");
  const tc = await getTranslations("contact");
  const locale = (await getLocale()) as Locale;

  return (
    <section className="shell reveal py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading title={t("title")} lead={t("lead")} />

          {googleProfileVerified ? (
            <div className="flex items-center gap-4">
              <Stars rating={business.google.rating} />
              <p className="text-sm text-ink-soft">
                {t("rating", { rating: business.google.rating })} ·{" "}
                {t("reviews", { count: business.google.reviewCount })}
              </p>
            </div>
          ) : (
            <p className="max-w-md border-l-2 border-marigold pl-4 text-sm leading-relaxed text-ink-faint">
              {t("pending")}
            </p>
          )}

          <dl className="grid gap-6 border-t border-line pt-8 sm:grid-cols-2">
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                {business.neighborhood}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">
                {translate(business.addressNote, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
                {translate(business.serviceArea, locale)}
              </dt>
              {/*
                No summarised opening hours here: Monday's 10–18 is not
                Friday's 10–16 or Saturday's 11–15, and this section is the one
                place the site must never contradict the Google listing. The
                contact page renders the full per-day table from the same data.
              */}
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">
                {tc("byAppointment")}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3">
            <ExternalButtonLink href={business.google.profileUrl} size="small">
              {t("view")}
            </ExternalButtonLink>
            <ExternalButtonLink href={business.google.directionsUrl} tone="outline" size="small">
              {t("directions")}
            </ExternalButtonLink>
            <ExternalButtonLink href={business.google.reviewUrl} tone="outline" size="small">
              {t("review")}
            </ExternalButtonLink>
          </div>
        </div>

        <div className="aspect-4/3 overflow-hidden bg-paper-warm">
          <iframe
            src={business.google.mapEmbedUrl}
            title={t("map")}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0 grayscale-[0.35] contrast-[1.05]"
          />
        </div>
      </div>
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 20 20" className="h-4 w-4">
          <path
            d="M10 1.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L10 14.9l-5.25 2.75 1-5.85L1.5 7.65l5.9-.85z"
            fill={index < Math.round(rating) ? "var(--color-marigold)" : "var(--color-paper-deep)"}
          />
        </svg>
      ))}
    </div>
  );
}
