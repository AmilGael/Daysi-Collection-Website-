import { appendRecord, latestBy, readRecords } from "./records";
import { styles } from "@/content";
import type { GarmentStyle, Premiere, StylePhoto } from "@/content/types";
import { retiredSet } from "./retired";
import { applyStyleText, textOverrides, type TextOverride } from "./live-text";
import { availableCount, takenFromOrders, type TakenPiece } from "./stock";

/**
 * The live layer over the static catalog.
 *
 * `content/styles.ts` stays the single source of what a style *is* — its name,
 * photos, copy and price entry. What changes week to week — whether a size is
 * on the rack, whether a piece is shown at all — is Daysi's to set from the
 * office, and lands here as append-only override records. Readers merge the
 * newest override per style onto the static definition, so deleting the
 * `.data` folder simply returns the site to the catalog as coded.
 */

/**
 * Per size: a number is the pieces Daysi counted on the rack; true or false
 * is the older switch, for a size she has not counted, which never runs out.
 */
export type SizeStock = Readonly<Partial<Record<"s" | "m" | "l", boolean | number>>>;

export type StyleOverride = {
  readonly styleId: string;
  readonly isPublished: boolean;
  readonly stock: SizeStock;
  /** When each counted size was counted; a sale is taken off only if paid after this. */
  readonly countedAt?: Readonly<Partial<Record<"s" | "m" | "l", string>>>;
  /** Photos Daysi has added from the office, shown after the coded ones. */
  readonly addedPhotos?: readonly string[];
  /** When set, the photo with this src leads the style's gallery. */
  readonly coverSrc?: string;
  /**
   * The complete list of photos to show, in order; the first is the cover.
   * A coded photo left out is hidden, never deleted. Absent on records
   * written before 15 September 2026, which read by addedPhotos and
   * coverSrc as they always did.
   */
  readonly photos?: readonly string[];
  /** Offered in the design studio. Absent says nothing, so the garment's own flag stands. */
  readonly inStudio?: boolean;
  /**
   * The garment's own price in cents, instead of its pair's list price.
   * Unlike the studio flag, the record is the whole truth here, as with
   * `photos`: a newer record without it puts the list price back, which is
   * also how an undo takes an own price away.
   */
  readonly fixedPrice?: number;
  /** Its own made-to-measure extra; only read beside `fixedPrice`. Absent = the pair's extra. */
  readonly customizationExtra?: number;
  readonly updatedAt: string;
};

export type SiteNotice = {
  readonly message: string;
  readonly visible: boolean;
  readonly updatedAt: string;
};

const OVERRIDES = "style-overrides";
const NOTICE = "site-notice";

export function styleOverrides(): StyleOverride[] {
  return latestBy(readRecords<StyleOverride>(OVERRIDES), (record) => record.styleId);
}

export async function saveStyleOverride(
  override: Omit<StyleOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(OVERRIDES, { ...override, updatedAt: new Date().toISOString() });
}

/**
 * Pure merge, separated so it can be tested without touching the filesystem.
 * An override only speaks about what it names: a size missing from `stock`
 * keeps the stock state the catalog shipped with.
 */
export function applyOverrides(
  catalog: readonly GarmentStyle[],
  overrides: readonly StyleOverride[],
  taken: readonly TakenPiece[] = [],
): GarmentStyle[] {
  const byId = new Map(overrides.map((override) => [override.styleId, override]));
  return catalog.map((style) => {
    const override = byId.get(style.id);
    if (!override) return style;

    const atelierAlt = {
      en: `${style.name.en}, photographed in the atelier.`,
      es: `${style.name.es}, fotografiado en el taller.`,
    };

    let photos: StylePhoto[];
    if (override.photos) {
      // The list is the truth: coded photos keep their alt, uploads get the
      // atelier's, a src the garment never owned is dropped, and a list that
      // names nothing it owns changes nothing.
      const coded = new Map(style.photos.map((photo) => [photo.src, photo]));
      const listed = override.photos.flatMap((src) => {
        const known = coded.get(src);
        if (known) return [known];
        if (src.startsWith("/uploads/")) return [{ src, alt: atelierAlt, isPrimary: false }];
        return [];
      });
      photos = (listed.length > 0 ? listed : [...style.photos]).map((photo, index) => ({
        ...photo,
        isPrimary: index === 0,
      }));
    } else {
      const added = (override.addedPhotos ?? []).map((src) => ({ src, alt: atelierAlt, isPrimary: false }));
      photos = [...style.photos, ...added];
      if (override.coverSrc && photos.some((photo) => photo.src === override.coverSrc)) {
        photos = [
          ...photos.filter((photo) => photo.src === override.coverSrc).map((photo) => ({ ...photo, isPrimary: true })),
          ...photos.filter((photo) => photo.src !== override.coverSrc).map((photo) => ({ ...photo, isPrimary: false })),
        ];
      }
    }

    return {
      ...style,
      isPublished: override.isPublished,
      photos,
      sizes: style.sizes.map((offered) => {
        const sizeId = offered.sizeId as keyof SizeStock;
        const stocked = override.stock[sizeId];
        if (stocked === undefined) return offered;
        if (typeof stocked === "boolean") return { sizeId: offered.sizeId, inStock: stocked };
        const count = availableCount(stocked, override.countedAt?.[sizeId], taken, style.id, sizeId);
        return { sizeId: offered.sizeId, inStock: count > 0, count };
      }),
      ...(override.inStudio === undefined ? {} : { inStudio: override.inStudio }),
      ...(override.fixedPrice === undefined
        ? {}
        : {
            ownPrice: {
              fixedPrice: override.fixedPrice,
              ...(override.customizationExtra === undefined
                ? {}
                : { customizationExtra: override.customizationExtra }),
            },
          }),
    };
  });
}


/**
 * Seed plus the garments Daysi has added, with her overrides applied to both.
 * A garment she edits twice is one garment: the newest record wins.
 *
 * Her own garments lead, the one she added last first: a piece she has just
 * put up is the one the collection and the homepage should show. A garment
 * keeps the place its first record gave it, so editing an older piece never
 * moves it back to the front.
 */
export function assembleStyles(
  seed: readonly GarmentStyle[],
  added: readonly GarmentStyle[],
  overrides: readonly StyleOverride[],
  retired: ReadonlySet<string> = new Set(),
  texts: readonly TextOverride[] = [],
  taken: readonly TakenPiece[] = [],
): GarmentStyle[] {
  const newest = new Map(added.map((style) => [style.id, style]));
  const seeded = new Set(seed.map((style) => style.id));
  const catalog = [
    ...[...newest.values()].filter((style) => !seeded.has(style.id)).reverse(),
    ...seed.map((style) => newest.get(style.id) ?? style),
  ];
  // Words first: applyOverrides builds alt text for added photos out of the name.
  return applyOverrides(applyStyleText(catalog, texts), overrides, taken).filter(
    (style) => !retired.has(style.id),
  );
}

const ADDED_STYLES = "added-styles";

/** The garments Daysi has created from the office, newest record per id. */
export function addedStyles(): GarmentStyle[] {
  return latestBy(readRecords<GarmentStyle>(ADDED_STYLES), (style) => style.id);
}

export async function saveAddedStyle(style: GarmentStyle): Promise<void> {
  await appendRecord(ADDED_STYLES, style);
}

/** The catalog as the public site should see it right now. */
export function liveStyles(): GarmentStyle[] {
  return allLiveStyles().filter((style) => style.isPublished);
}

/** The garments the design studio offers beside a fabric: live, and switched on. */
export function liveStudioStyles(): GarmentStyle[] {
  return liveStyles().filter((style) => style.inStudio === true);
}

/** Every style, published or not, with overrides applied — the office view. */
export function allLiveStyles(): GarmentStyle[] {
  return assembleStyles(
    styles,
    addedStyles(),
    styleOverrides(),
    retiredSet("style"),
    textOverrides(),
    takenFromOrders(),
  );
}

/** Every style including retired ones, each flagged for the office view. */
export function manageableStyles(): (GarmentStyle & { retired: boolean })[] {
  const retired = retiredSet("style");
  return assembleStyles(
    styles,
    addedStyles(),
    styleOverrides(),
    new Set(),
    textOverrides(),
    takenFromOrders(),
  ).map((style) => ({ ...style, retired: retired.has(style.id) }));
}

export function liveStyleBySlug(slug: string): GarmentStyle | undefined {
  return liveStyles().find((style) => style.slug === slug);
}

/** The premiere's pieces as the site shows them now: corrected, and only if still published. */
export function liveStylesInPremiere(premiere: Premiere): GarmentStyle[] {
  const live = new Map(liveStyles().map((style) => [style.id, style]));
  return premiere.styleIds
    .map((id) => live.get(id))
    .filter((style): style is GarmentStyle => style !== undefined);
}

export function currentNotice(): SiteNotice | null {
  const records = readRecords<SiteNotice>(NOTICE);
  const latest = records.at(-1);
  if (!latest || !latest.visible || latest.message.trim().length === 0) return null;
  return latest;
}

/** The newest notice regardless of visibility, so the office can re-edit it. */
export function storedNotice(): SiteNotice | null {
  return readRecords<SiteNotice>(NOTICE).at(-1) ?? null;
}

export async function saveNotice(notice: Omit<SiteNotice, "updatedAt">): Promise<void> {
  await appendRecord(NOTICE, { ...notice, updatedAt: new Date().toISOString() });
}
