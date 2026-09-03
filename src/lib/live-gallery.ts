import { galleryWorks } from "@/content/gallery";
import type { GalleryCategoryId, GalleryWork } from "@/content/types";
import { appendRecord, readRecords } from "./records";
import { retiredSet } from "./retired";
import { applyGalleryText, textOverrides, type TextOverride } from "./live-text";

/**
 * The live layer over the gallery, same shape as lib/live-catalog: the works
 * that shipped with the site are the seed, and everything Daysi does from the
 * office is an append-only record merged over it. Deleting `.data` returns the
 * gallery to the seed.
 *
 * Hiding rather than deleting is deliberate. A photograph she takes down for a
 * season is not a photograph she wants to lose, and the store keeps its own
 * history either way.
 */

export type GalleryVisibility = { readonly id: string; readonly hidden: boolean };

const ADDED = "gallery-works";
const VISIBILITY = "gallery-visibility";

/**
 * Pure, so the merge can be tested without touching the filesystem. Later
 * records win over earlier ones, and a work Daysi re-adds under an existing id
 * replaces that entry in place rather than appearing twice.
 */
export function assembleGallery(
  seed: readonly GalleryWork[],
  added: readonly GalleryWork[],
  visibility: readonly GalleryVisibility[],
  retired: ReadonlySet<string> = new Set(),
  texts: readonly TextOverride[] = [],
): GalleryWork[] {
  const hidden = new Map(visibility.map((record) => [record.id, record.hidden]));
  const newest = new Map(added.map((work) => [work.id, work]));
  const seeded = new Set(seed.map((work) => work.id));

  return applyGalleryText(
    [
      ...seed.map((work) => newest.get(work.id) ?? work),
      ...[...newest.values()].filter((work) => !seeded.has(work.id)),
    ],
    texts,
  ).filter((work) => hidden.get(work.id) !== true && !retired.has(work.id));
}

/** The gallery as a visitor sees it. */
export function liveGallery(): GalleryWork[] {
  return assembleGallery(
    galleryWorks,
    readRecords<GalleryWork>(ADDED),
    readRecords<GalleryVisibility>(VISIBILITY),
    retiredSet("gallery"),
    textOverrides(),
  );
}

/** Every work including the hidden ones, each flagged — the office view. */
export function manageableGallery(): (GalleryWork & { hidden: boolean; retired: boolean })[] {
  const hidden = new Map(
    readRecords<GalleryVisibility>(VISIBILITY).map((record) => [record.id, record.hidden]),
  );
  const retired = retiredSet("gallery");
  const all = assembleGallery(
    galleryWorks,
    readRecords<GalleryWork>(ADDED),
    [],
    new Set(),
    textOverrides(),
  );
  return all.map((work) => ({
    ...work,
    hidden: hidden.get(work.id) === true,
    retired: retired.has(work.id),
  }));
}

/** The categories that actually have something in them, in display order. */
export const GALLERY_ORDER: readonly GalleryCategoryId[] = [
  "runway",
  "commissions",
  "bridal",
  "accessories",
  "workroom",
  "press",
];

export function galleryByCategory(
  works: readonly GalleryWork[],
): { category: GalleryCategoryId; works: GalleryWork[] }[] {
  return GALLERY_ORDER.map((category) => ({
    category,
    works: works.filter((work) => work.category === category),
  })).filter((group) => group.works.length > 0);
}

export async function addGalleryWork(work: GalleryWork): Promise<void> {
  await appendRecord(ADDED, work);
}

export async function setGalleryVisibility(id: string, hidden: boolean): Promise<void> {
  await appendRecord(VISIBILITY, { id, hidden } satisfies GalleryVisibility);
}
