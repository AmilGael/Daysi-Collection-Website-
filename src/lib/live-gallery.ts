import { galleryWorks } from "@/content/gallery";
import type { GalleryWork, Localized } from "@/content/types";
import { appendRecord, readRecords } from "./records";
import { retiredSet } from "./retired";
import { applyGalleryText, textOverrides, type TextOverride } from "./live-text";

export { sectionId } from "./slugify";

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

export function addedGalleryWorks(): GalleryWork[] {
  return readRecords<GalleryWork>(ADDED);
}

export function galleryVisibility(): GalleryVisibility[] {
  return readRecords<GalleryVisibility>(VISIBILITY);
}

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
    addedGalleryWorks(),
    galleryVisibility(),
    retiredSet("gallery"),
    textOverrides(),
  );
}

/** Every work including the hidden ones, each flagged — the office view. */
export function manageableGallery(): (GalleryWork & { hidden: boolean; retired: boolean })[] {
  const hidden = new Map(
    galleryVisibility().map((record) => [record.id, record.hidden]),
  );
  const retired = retiredSet("gallery");
  const all = assembleGallery(
    galleryWorks,
    addedGalleryWorks(),
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

export async function addGalleryWork(work: GalleryWork): Promise<void> {
  await appendRecord(ADDED, work);
}

export async function setGalleryVisibility(id: string, hidden: boolean): Promise<void> {
  await appendRecord(VISIBILITY, { id, hidden } satisfies GalleryVisibility);
}

// ── Gallery sections ("Dónde va") ───────────────────────────────────────────

/**
 * The six sections the site shipped with, in the order the gallery and the
 * office both show them. Their labels come from `gallery.category.*`; a
 * section Daysi names herself through "Otra…" carries its own bilingual
 * name instead, and joins the list after these, oldest first.
 */
export const CODED_SECTIONS = [
  "runway",
  "commissions",
  "bridal",
  "accessories",
  "workroom",
  "press",
] as const;

/** A section Daysi named herself: one line in gallery-sections.jsonl. */
export type GallerySection = { readonly id: string; readonly name: Localized; readonly addedAt: string };

/**
 * One row of "Dónde va" as a reader shows it: a coded section, whose label
 * lives in `gallery.category.*`, or one Daysi added, which carries its own.
 */
export type SectionView = { readonly id: string; readonly coded: boolean; readonly name?: Localized };

const SECTIONS = "gallery-sections";

export function addedGallerySections(): GallerySection[] {
  return readRecords<GallerySection>(SECTIONS);
}

/**
 * Pure, so it can be tested without the filesystem: the six coded sections
 * first, in their fixed order, then whatever Daysi has added, oldest first.
 * A coded section is filtered out of `ordered`'s map, never out of
 * `CODED_SECTIONS` itself, so it can never be dropped by `retired` even if
 * that set somehow named one — office/gallery/actions.ts never lets a
 * coded section be retired in the first place.
 */
export function assembleSections(
  added: readonly GallerySection[],
  retired: ReadonlySet<string>,
): SectionView[] {
  const newest = new Map(added.map((section) => [section.id, section]));
  const ordered = [...newest.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return [
    ...CODED_SECTIONS.map((id): SectionView => ({ id, coded: true })),
    ...ordered
      .filter((section) => !retired.has(section.id))
      .map((section): SectionView => ({ id: section.id, coded: false, name: section.name })),
  ];
}

/** "Dónde va" as a visitor's filter sees it: nothing retired. */
export function liveGallerySections(): SectionView[] {
  return assembleSections(addedGallerySections(), retiredSet("gallery-section"));
}

/** Every section, retired ones flagged too — the office's picker and its Secciones list. */
export function manageableGallerySections(): (SectionView & { retired: boolean })[] {
  const retired = retiredSet("gallery-section");
  return assembleSections(addedGallerySections(), new Set()).map((section) => ({
    ...section,
    retired: retired.has(section.id),
  }));
}

/** The sections that actually have something in them, in `sections`' order. */
export function galleryByCategory(
  works: readonly GalleryWork[],
  sections: readonly SectionView[],
): { section: SectionView; works: GalleryWork[] }[] {
  return sections
    .map((section) => ({ section, works: works.filter((work) => work.category === section.id) }))
    .filter((group) => group.works.length > 0);
}

export async function addGallerySection(section: GallerySection): Promise<void> {
  await appendRecord(SECTIONS, section);
}
