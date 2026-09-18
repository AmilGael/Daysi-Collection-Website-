"use server";

import { premieres, type Premiere } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { translationEnabled } from "@/lib/env";
import { manageableStyles } from "@/lib/live-catalog";
import {
  addedPremieres,
  assemblePremieres,
  manageablePremieres,
  premiereOverrides,
  premiereOverrideVersions,
  saveAddedPremiere,
  savePremiereOverride,
  type PremiereOverride,
} from "@/lib/live-premieres";
import { changesOf, premiereChangeSchema } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { slugify } from "@/lib/slugify";
import { translateToEnglish, withEnglish } from "@/lib/translate";

type Field = "season" | "title" | "story" | "inspiration";
const TEXT_FIELDS: readonly Field[] = ["season", "title", "story", "inspiration"];
const UPLOAD_PATH = /^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/;

/**
 * Every garment id the catalog knows, retired or not, and the ones still
 * live. A retired garment stays on any season's checklist it was already on
 * (the public site hides it, and restoring it brings it back to its season);
 * it just cannot be added to a checklist it was not on.
 */
function garmentIds(): { known: Set<string>; live: Set<string> } {
  const known = new Set<string>();
  const live = new Set<string>();
  for (const style of manageableStyles()) {
    known.add(style.id);
    if (!style.retired) live.add(style.id);
  }
  return { known, live };
}

/**
 * Every Spanish/English pairing a field has ever had for this season,
 * oldest first: the season as seeded or added, then each saved override in
 * turn (only the ones that actually named the field). An undo often sends
 * back Spanish that matches one of these older pairings rather than the
 * current one — that pairing's English is what gets reused, in
 * `wordFor` below, instead of a fresh translation call.
 */
function knownPairings(
  field: Field,
  seeded: Premiere,
  versions: readonly PremiereOverride[],
): readonly { es: string; en: string }[] {
  const pairings = [seeded[field]];
  for (const version of versions) {
    const value = version[field];
    if (value) pairings.push(value);
  }
  return pairings;
}

/**
 * Whatever this season's override already carries, minus its key and stamp.
 * Every save below starts here and layers its own fields on top, so a
 * checklist save never loses a pending words edit and a words edit never
 * loses a saved checklist — the same reasoning collection/actions.ts's
 * `mergedStock` gives for a style's stock.
 */
function previousOverrideFields(premiereId: string): Omit<PremiereOverride, "premiereId" | "updatedAt"> {
  const previous = premiereOverrides().find((override) => override.premiereId === premiereId);
  if (!previous) return {};
  const { premiereId: _premiereId, updatedAt: _updatedAt, ...fields } = previous;
  return fields;
}

export const applyPremiereChanges = ownerAction(
  changesOf(premiereChangeSchema),
  async (changes) => {
    // Read once for the whole batch: nothing in it retires or restores a garment.
    const garments = garmentIds();
    return applyEach(changes, async (change) => {
      switch (change.type) {
        case "premiere-create": {
          if (change.releaseDate < change.revealDate) throw new ChangeRefused("bad-dates");
          if (change.styleIds.some((id) => !garments.live.has(id))) throw new ChangeRefused("unknown-style");

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

          // The season as it was seeded or added, with no override at all:
          // an undo can land on this, or on any saved version, so both the
          // cover check and the translation reuse below read from it.
          const seeded = assemblePremieres(premieres, addedPremieres(), []).find(
            (candidate) => candidate.id === change.premiereId,
          );
          if (!seeded) throw new ChangeRefused("unknown-premiere");

          // A premiere-update's checklist only ever arrives from an undo
          // (a live edit of the checklist stages its own premiere-styles),
          // and an undo must still land whatever has happened to the
          // garments on that older checklist since. A retired one stays on
          // it, like on any checklist; an id the catalog does not know at
          // all is dropped silently rather than refusing the whole change.
          const styleIds = change.styleIds?.filter((id) => garments.known.has(id));

          // A cover coming back unchanged (an undo landing on the season as
          // it was seeded or added, before any override) is not an upload,
          // and must not be refused as one.
          if (
            change.coverImage !== undefined &&
            change.coverImage !== premiere.coverImage &&
            change.coverImage !== seeded.coverImage &&
            !UPLOAD_PATH.test(change.coverImage)
          ) {
            throw new ChangeRefused("invalid");
          }

          // Only Spanish that has never been paired with the English it
          // would otherwise get is translated. A field sent back exactly as
          // it was seeded, added, or saved at any earlier point — most
          // often an undo — reuses that pairing's English instead of a
          // fresh call copying the Spanish over good English. A pairing
          // whose English is only a copy of the Spanish — saved with no key
          // present — is the one exception: once a key arrives, that copy
          // is translated for real rather than followed forever.
          const versions = premiereOverrideVersions(change.premiereId);
          const toTranslate: Record<string, string> = {};
          const reused: Partial<Record<Field, { es: string; en: string }>> = {};
          for (const field of TEXT_FIELDS) {
            const value = change[field];
            if (value === undefined) continue;
            const known = knownPairings(field, seeded, versions).findLast((pair) => pair.es === value);
            if (known && !(translationEnabled && known.en === known.es)) reused[field] = known;
            else toTranslate[field] = value;
          }
          const translated =
            Object.keys(toTranslate).length > 0
              ? withEnglish(toTranslate, await translateToEnglish(toTranslate, "premiere"))
              : {};
          const wordFor = (field: Field): { es: string; en: string } | undefined =>
            reused[field] ?? translated[field];

          await savePremiereOverride({
            ...previousOverrideFields(change.premiereId),
            premiereId: change.premiereId,
            ...(change.season !== undefined ? { season: wordFor("season")! } : {}),
            ...(change.title !== undefined ? { title: wordFor("title")! } : {}),
            ...(change.story !== undefined ? { story: wordFor("story")! } : {}),
            ...(change.inspiration !== undefined ? { inspiration: wordFor("inspiration")! } : {}),
            ...(change.revealDate === undefined ? {} : { revealDate: change.revealDate }),
            ...(change.releaseDate === undefined ? {} : { releaseDate: change.releaseDate }),
            ...(change.piecesPlanned === undefined ? {} : { piecesPlanned: change.piecesPlanned }),
            ...(change.editionSize === undefined ? {} : { editionSize: change.editionSize }),
            ...(change.coverImage === undefined ? {} : { coverImage: change.coverImage }),
            ...(styleIds === undefined ? {} : { styleIds }),
          });
          return;
        }
        case "premiere-styles": {
          const premiere = manageablePremieres().find((candidate) => candidate.id === change.premiereId);
          if (!premiere) throw new ChangeRefused("unknown-premiere");
          // The checklist only offers live garments, so a retired one already
          // on it cannot be unticked and comes back with every save; it is
          // kept. One the catalog does not know, or a retired one new to the
          // checklist, is refused.
          const onChecklist = new Set(premiere.styleIds);
          const allowed = (id: string) => garments.live.has(id) || (garments.known.has(id) && onChecklist.has(id));
          if (!change.styleIds.every(allowed)) throw new ChangeRefused("unknown-style");
          await savePremiereOverride({
            ...previousOverrideFields(change.premiereId),
            premiereId: change.premiereId,
            styleIds: change.styleIds,
          });
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
    });
  },
  {
    revalidate: [
      "/[locale]/office/premieres",
      "/[locale]",
      "/[locale]/premieres",
      "/[locale]/collection/[slug]",
    ],
  },
);
