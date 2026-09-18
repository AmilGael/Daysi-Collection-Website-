"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { manageableStyles } from "@/lib/live-catalog";
import { manageablePremieres, saveAddedPremiere, savePremiereOverride } from "@/lib/live-premieres";
import { changesOf, premiereChangeSchema } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { slugify } from "@/lib/slugify";
import { translateToEnglish, withEnglish } from "@/lib/translate";

type Field = "season" | "title" | "story" | "inspiration";
const UPLOAD_PATH = /^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/;

/** The garments a season may be built from: live, and not retired. */
function liveStyleIds(): Set<string> {
  return new Set(manageableStyles().filter((style) => !style.retired).map((style) => style.id));
}

function checkStyleIds(styleIds: readonly string[]): void {
  const live = liveStyleIds();
  if (styleIds.some((id) => !live.has(id))) throw new ChangeRefused("unknown-style");
}

export const applyPremiereChanges = ownerAction(
  changesOf(premiereChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "premiere-create": {
          if (change.releaseDate < change.revealDate) throw new ChangeRefused("bad-dates");
          checkStyleIds(change.styleIds);

          const spanish = {
            season: change.season,
            title: change.title,
            story: change.story,
            inspiration: change.inspiration,
          };
          const paired = withEnglish(spanish, await translateToEnglish(spanish, "premiere"));
          // withEnglish pairs every key of `spanish`, so each field below is
          // present; noUncheckedIndexedAccess cannot see that from the
          // Record<string, ...> it returns.
          const words: Record<Field, { es: string; en: string }> = {
            season: paired.season!,
            title: paired.title!,
            story: paired.story!,
            inspiration: paired.inspiration!,
          };

          // Retired seasons keep their slugs so restoring one cannot create a collision.
          const taken = new Set(manageablePremieres().map((premiere) => premiere.slug));
          const base = slugify(words.title.es, 50) || newReference("EST").toLowerCase();
          let slug = base;
          for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

          await saveAddedPremiere({
            id: newReference("EST").toLowerCase(),
            slug,
            season: words.season,
            title: words.title,
            story: words.story,
            inspiration: words.inspiration,
            revealDate: change.revealDate,
            releaseDate: change.releaseDate,
            piecesPlanned: change.piecesPlanned,
            editionSize: change.editionSize,
            coverImage: change.coverImage,
            styleIds: change.styleIds,
            added: true,
            addedAt: new Date().toISOString(),
          });
          return;
        }
        case "premiere-update": {
          const premiere = manageablePremieres().find((candidate) => candidate.id === change.premiereId);
          if (!premiere) throw new ChangeRefused("unknown-premiere");

          const revealDate = change.revealDate ?? premiere.revealDate;
          const releaseDate = change.releaseDate ?? premiere.releaseDate;
          if (releaseDate < revealDate) throw new ChangeRefused("bad-dates");

          if (
            change.coverImage !== undefined &&
            change.coverImage !== premiere.coverImage &&
            !UPLOAD_PATH.test(change.coverImage)
          ) {
            throw new ChangeRefused("invalid");
          }

          const spanish: Record<string, string> = {};
          if (change.season !== undefined) spanish.season = change.season;
          if (change.title !== undefined) spanish.title = change.title;
          if (change.story !== undefined) spanish.story = change.story;
          if (change.inspiration !== undefined) spanish.inspiration = change.inspiration;
          const hasText = Object.keys(spanish).length > 0;
          const words = hasText
            ? withEnglish(spanish, await translateToEnglish(spanish, "premiere"))
            : {};

          await savePremiereOverride({
            premiereId: change.premiereId,
            ...(change.season !== undefined ? { season: words.season! } : {}),
            ...(change.title !== undefined ? { title: words.title! } : {}),
            ...(change.story !== undefined ? { story: words.story! } : {}),
            ...(change.inspiration !== undefined ? { inspiration: words.inspiration! } : {}),
            ...(change.revealDate === undefined ? {} : { revealDate: change.revealDate }),
            ...(change.releaseDate === undefined ? {} : { releaseDate: change.releaseDate }),
            ...(change.piecesPlanned === undefined ? {} : { piecesPlanned: change.piecesPlanned }),
            ...(change.editionSize === undefined ? {} : { editionSize: change.editionSize }),
            ...(change.coverImage === undefined ? {} : { coverImage: change.coverImage }),
          });
          return;
        }
        case "premiere-styles": {
          if (!manageablePremieres().some((premiere) => premiere.id === change.premiereId)) {
            throw new ChangeRefused("unknown-premiere");
          }
          checkStyleIds(change.styleIds);
          await savePremiereOverride({ premiereId: change.premiereId, styleIds: change.styleIds });
          return;
        }
        case "retire":
          if (!manageablePremieres().some((premiere) => premiere.id === change.id)) {
            throw new ChangeRefused("unknown-premiere");
          }
          await setRetired("premiere", change.id, true);
          return;
        case "restore":
          if (!manageablePremieres().some((premiere) => premiere.id === change.id)) {
            throw new ChangeRefused("unknown-premiere");
          }
          await setRetired("premiere", change.id, false);
      }
    }),
  {
    revalidate: [
      "/[locale]/office/premieres",
      "/[locale]",
      "/[locale]/premieres",
      "/[locale]/collection/[slug]",
    ],
  },
);

