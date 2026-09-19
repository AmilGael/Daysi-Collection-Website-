import type { GalleryWork, GarmentStyle, Localized } from "@/content/types";

/**
 * The photographs along the homepage strip: finished work from the gallery,
 * so the first thing below the fold is what she makes rather than a
 * paragraph about it. The garments for sale are left to the collection.
 *
 * Only her own folders are shown. The woven ground behind the hero is a
 * generated texture and sits outside them on purpose; nothing generated goes
 * in a row that says "this is her work".
 */

export type StripPhoto = {
  readonly key: string;
  readonly src: string;
  readonly alt: Localized;
  readonly href: string;
  /** Width over height, as the piece was photographed. */
  readonly aspect: number;
};

const OWN_FOLDERS = ["/images/real/", "/images/gallery/", "/uploads/"];

function isOwn(src: string): boolean {
  return OWN_FOLDERS.some((folder) => src.startsWith(folder));
}

export function stripPhotos(
  styles: readonly GarmentStyle[],
  gallery: readonly GalleryWork[],
  cap: number,
): StripPhoto[] {
  // What is for sale lives in the collection, with its price and sizes; the
  // strip is her finished work, so no garment photo is shown here, not even
  // one that was also filed in the gallery (walkthrough, 19 Sept 2026).
  const forSale = new Set(styles.flatMap((style) => style.photos.map((photo) => photo.src)));
  const seen = new Set<string>();
  const strip: StripPhoto[] = [];
  for (const piece of gallery) {
    if (strip.length >= cap) break;
    if (!isOwn(piece.src) || forSale.has(piece.src) || seen.has(piece.src)) continue;
    seen.add(piece.src);
    strip.push({
      key: `work-${piece.id}`,
      src: piece.src,
      alt: piece.caption,
      href: "/gallery",
      aspect: piece.width / piece.height,
    });
  }
  return strip;
}
