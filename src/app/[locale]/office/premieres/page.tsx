import { getTranslations, setRequestLocale } from "next-intl/server";
import { translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { manageableStyles } from "@/lib/live-catalog";
import { manageablePremieres } from "@/lib/live-premieres";
import { undoableIds } from "@/lib/office-history";
import { activeRequests, type StoredRequest } from "@/lib/request-store";
import { PremiereManager, type ManagedPremiere } from "@/components/premiere-manager";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyPremiereChanges } from "./actions";

/**
 * How many sign-ups a season has: matched by the id the sign-up carries,
 * with a fallback on the English title for lines written before a sign-up
 * carried the id at all.
 */
function signupsFor(premiere: { id: string; title: { en: string } }, signups: readonly StoredRequest[]): number {
  return signups.filter((request) => {
    const id = request.details.PremiereId;
    if (typeof id === "string" && id.length > 0) return id === premiere.id;
    return request.details.Premiere === premiere.title.en;
  }).length;
}

/** Estrenos: the seasons announced ahead of being made, and who is on their list. */
export default async function OfficePremieresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");
  const undoable = undoableIds("premiere");
  const signups = activeRequests("premiere-signup");
  const premieres = manageablePremieres();

  const managed: ManagedPremiere[] = premieres.map((premiere) => ({
    id: premiere.id,
    slug: premiere.slug,
    season: translate(premiere.season, language),
    title: translate(premiere.title, language),
    words: {
      season: premiere.season.es,
      title: premiere.title.es,
      story: premiere.story.es,
      inspiration: premiere.inspiration.es,
    },
    revealDate: premiere.revealDate,
    releaseDate: premiere.releaseDate,
    piecesPlanned: premiere.piecesPlanned,
    editionSize: premiere.editionSize,
    coverImage: premiere.coverImage,
    // Retired garments included: the checklist below offers only live ones,
    // so a retired one rides along with every save and stays on its season.
    styleIds: premiere.styleIds,
    signups: signupsFor(premiere, signups),
    retired: premiere.retired,
    undoable: undoable.has(premiere.id),
  }));

  const styles = manageableStyles()
    .filter((style) => !style.retired)
    .map((style) => ({ id: style.id, label: translate(style.name, language), photo: style.photos[0]?.src }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("premieresTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("premieresLead")}
        </p>
      </div>
      <OfficeDraftProvider apply={applyPremiereChanges}>
        <PremiereManager
          premieres={managed.filter((premiere) => !premiere.retired)}
          retired={managed.filter((premiere) => premiere.retired)}
          styles={styles}
        />
      </OfficeDraftProvider>
    </section>
  );
}
