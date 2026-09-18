import { premieres, premiereListingFrom, type Localized, type Premiere } from "@/content";
import { appendRecord, latestBy, readRecords } from "./records";
import { retiredSet } from "./retired";

/**
 * The live layer over the seeded premieres — the same idea as
 * `lib/live-catalog.ts`: `content/premieres.ts` stays the two seasons as
 * coded, and a season Daysi adds or corrects from the office lands here as
 * append-only records. Readers merge the newest override per id onto the
 * seed (and onto a season she added herself), so the "Estrenos" tab and the
 * public premiere pages agree on what is running.
 */

export type AddedPremiere = Premiere & { readonly added: true; readonly addedAt: string };

export type PremiereOverride = {
  readonly premiereId: string;
  readonly season?: Localized;
  readonly title?: Localized;
  readonly story?: Localized;
  readonly inspiration?: Localized;
  readonly revealDate?: string;
  readonly releaseDate?: string;
  readonly piecesPlanned?: number;
  readonly editionSize?: number;
  readonly coverImage?: string;
  readonly styleIds?: readonly string[];
  readonly updatedAt: string;
};

const ADDED_PREMIERES = "added-premieres";
const PREMIERE_OVERRIDES = "premiere-overrides";

/** The seasons Daysi has created from the office, newest record per id. */
export function addedPremieres(): AddedPremiere[] {
  return latestBy(readRecords<AddedPremiere>(ADDED_PREMIERES), (premiere) => premiere.id);
}

export function premiereOverrides(): PremiereOverride[] {
  return latestBy(readRecords<PremiereOverride>(PREMIERE_OVERRIDES), (record) => record.premiereId);
}

export async function saveAddedPremiere(premiere: AddedPremiere): Promise<void> {
  await appendRecord(ADDED_PREMIERES, premiere);
}

export async function savePremiereOverride(
  override: Omit<PremiereOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(PREMIERE_OVERRIDES, { ...override, updatedAt: new Date().toISOString() });
}

/** An added premiere as it sits in the merged catalog: itself, minus the office-only marks. */
function bare(premiere: AddedPremiere): Premiere {
  const { added: _added, addedAt: _addedAt, ...rest } = premiere;
  return rest;
}

/**
 * Pure: seed plus what Daysi has added, her overrides on top field by field,
 * retired seasons dropped, sorted by release date so the newest is always
 * first — the order `premiereListingFrom` depends on to call the first
 * still-to-be-released entry "next". An added season sharing a seed id
 * replaces it outright, the way an added garment does in `assembleStyles`.
 */
export function assemblePremieres(
  seed: readonly Premiere[],
  added: readonly AddedPremiere[],
  overrides: readonly PremiereOverride[],
  retired: ReadonlySet<string> = new Set(),
): Premiere[] {
  const newest = new Map(added.map((premiere) => [premiere.id, premiere]));
  const seeded = new Set(seed.map((premiere) => premiere.id));
  const catalog: Premiere[] = [
    ...seed.map((premiere) => {
      const replacement = newest.get(premiere.id);
      return replacement ? bare(replacement) : premiere;
    }),
    ...[...newest.values()].filter((premiere) => !seeded.has(premiere.id)).map(bare),
  ];

  const overrideById = new Map(overrides.map((override) => [override.premiereId, override]));
  return catalog
    .map((premiere) => {
      const override = overrideById.get(premiere.id);
      if (!override) return premiere;
      const { premiereId: _premiereId, updatedAt: _updatedAt, ...fields } = override;
      return { ...premiere, ...fields };
    })
    .filter((premiere) => !retired.has(premiere.id))
    .sort((a, b) => (a.releaseDate < b.releaseDate ? 1 : a.releaseDate > b.releaseDate ? -1 : 0));
}

/** The seasons the public site should see right now. */
export function livePremieres(): Premiere[] {
  return assemblePremieres(premieres, addedPremieres(), premiereOverrides(), retiredSet("premiere"));
}

/** Every season, added ones and retired ones marked, for the office's own view. */
export function manageablePremieres(): (Premiere & { readonly added: boolean; readonly retired: boolean })[] {
  const added = new Set(addedPremieres().map((premiere) => premiere.id));
  const retired = retiredSet("premiere");
  return assemblePremieres(premieres, addedPremieres(), premiereOverrides()).map((premiere) => ({
    ...premiere,
    added: added.has(premiere.id),
    retired: retired.has(premiere.id),
  }));
}

/** A live season by its id or its slug — an id is what a sign-up or a garment's `premiereId` carries. */
export function liveFindPremiere(idOrSlug: string): Premiere | undefined {
  return livePremieres().find((premiere) => premiere.id === idOrSlug || premiere.slug === idOrSlug);
}

/** `premiereListingFrom`, run over the live seasons rather than the coded seed. */
export function livePremiereListing(today: Date): ReturnType<typeof premiereListingFrom> {
  return premiereListingFrom(livePremieres(), today);
}
