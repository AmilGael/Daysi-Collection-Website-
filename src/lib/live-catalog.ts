import { appendRecord, latestBy, readRecords } from "./records";
import { styles } from "@/content";
import type { GarmentStyle } from "@/content/types";
import { retiredSet } from "./retired";

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

export type SizeStock = Readonly<Partial<Record<"s" | "m" | "l", boolean>>>;

export type StyleOverride = {
  readonly styleId: string;
  readonly isPublished: boolean;
  readonly stock: SizeStock;
  /** Photos Daysi has added from the office, shown after the coded ones. */
  readonly addedPhotos?: readonly string[];
  /** When set, the photo with this src leads the style's gallery. */
  readonly coverSrc?: string;
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
): GarmentStyle[] {
  const byId = new Map(overrides.map((override) => [override.styleId, override]));
  return catalog.map((style) => {
    const override = byId.get(style.id);
    if (!override) return style;

    const added = (override.addedPhotos ?? []).map((src) => ({
      src,
      alt: {
        en: `${style.name.en}, photographed in the atelier.`,
        es: `${style.name.es}, fotografiado en el taller.`,
      },
      isPrimary: false,
    }));
    let photos = [...style.photos, ...added];
    if (override.coverSrc && photos.some((photo) => photo.src === override.coverSrc)) {
      photos = [
        ...photos.filter((photo) => photo.src === override.coverSrc).map((photo) => ({ ...photo, isPrimary: true })),
        ...photos.filter((photo) => photo.src !== override.coverSrc).map((photo) => ({ ...photo, isPrimary: false })),
      ];
    }

    return {
      ...style,
      isPublished: override.isPublished,
      photos,
      sizes: style.sizes.map((offered) => {
        const stocked = override.stock[offered.sizeId as keyof SizeStock];
        return stocked === undefined ? offered : { ...offered, inStock: stocked };
      }),
    };
  });
}


/**
 * Seed plus the garments Daysi has added, with her overrides applied to both.
 * A garment she edits twice is one garment: the newest record wins.
 */
export function assembleStyles(
  seed: readonly GarmentStyle[],
  added: readonly GarmentStyle[],
  overrides: readonly StyleOverride[],
  retired: ReadonlySet<string> = new Set(),
): GarmentStyle[] {
  const newest = new Map(added.map((style) => [style.id, style]));
  const seeded = new Set(seed.map((style) => style.id));
  const catalog = [
    ...seed.map((style) => newest.get(style.id) ?? style),
    ...[...newest.values()].filter((style) => !seeded.has(style.id)),
  ];
  return applyOverrides(catalog, overrides).filter((style) => !retired.has(style.id));
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

/** Every style, published or not, with overrides applied — the office view. */
export function allLiveStyles(): GarmentStyle[] {
  return assembleStyles(styles, addedStyles(), styleOverrides(), retiredSet("style"));
}

/** Every style including retired ones, each flagged for the office view. */
export function manageableStyles(): (GarmentStyle & { retired: boolean })[] {
  const retired = retiredSet("style");
  return assembleStyles(styles, addedStyles(), styleOverrides()).map((style) => ({
    ...style,
    retired: retired.has(style.id),
  }));
}

export function liveStyleBySlug(slug: string): GarmentStyle | undefined {
  return liveStyles().find((style) => style.slug === slug);
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
