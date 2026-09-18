import { primaryPhoto } from "@/content";
import type { GalleryWork, GarmentStyle, Localized } from "@/content/types";

/**
 * The photographs along the homepage strip: her garments, the one she put up
 * last first, taking turns with finished work from the gallery, so the first
 * thing below the fold is what she makes rather than a paragraph about it.
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
  /** Width over height. Garments share the collection's 3:4; gallery pieces keep their own. */
  readonly aspect: number;
};

const OWN_FOLDERS = ["/images/real/", "/images/gallery/", "/uploads/"];
const GARMENT_ASPECT = 3 / 4;

function isOwn(src: string): boolean {
  return OWN_FOLDERS.some((folder) => src.startsWith(folder));
}

function hasWords(alt: Localized): boolean {
  return alt.en.trim().length > 0 && alt.es.trim().length > 0;
}

export function stripPhotos(
  styles: readonly GarmentStyle[],
  gallery: readonly GalleryWork[],
  cap: number,
): StripPhoto[] {
  const garments = styles.flatMap((style): StripPhoto[] => {
    const photo = primaryPhoto(style);
    if (!photo || !isOwn(photo.src)) return [];
    return [
      {
        key: `style-${style.id}`,
        src: photo.src,
        alt: hasWords(photo.alt) ? photo.alt : style.name,
        href: `/collection/${style.slug}`,
        aspect: GARMENT_ASPECT,
      },
    ];
  });
  const works = gallery
    .filter((piece) => isOwn(piece.src))
    .map(
      (piece): StripPhoto => ({
        key: `work-${piece.id}`,
        src: piece.src,
        alt: piece.caption,
        href: "/gallery",
        aspect: piece.width / piece.height,
      }),
    );

  const seen = new Set<string>();
  const strip: StripPhoto[] = [];
  for (let index = 0; index < Math.max(garments.length, works.length); index += 1) {
    for (const photo of [garments[index], works[index]]) {
      if (!photo || seen.has(photo.src) || strip.length >= cap) continue;
      seen.add(photo.src);
      strip.push(photo);
    }
  }
  return strip;
}
