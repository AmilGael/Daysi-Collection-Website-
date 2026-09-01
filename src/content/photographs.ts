/**
 * The photographs that are not part of a catalogue.
 *
 * Everything else on the site is reached through the thing it pictures — a
 * style carries its own images, a fabric its swatch, a premiere its cover. The
 * hero belongs to no record, and its path was written out by hand in three
 * places: the home page, the site-wide link preview, and the fallback preview
 * for a garment with no photograph of its own. Changing the hero meant finding
 * all three.
 */

/**
 * The October 2019 magazine cover: Kalifa in a Daysi Collection print, under
 * the masthead, on the yellow Daysi chose for the brand.
 *
 * It is not treated the way the other photographs are, because it is not a
 * photograph. It is a piece of print with its own masthead, its own logo and
 * its own headline already set on it, and cropping into it would cut a design
 * somebody laid out. So the hero shows the whole thing, edge to edge, bounded
 * by ink — which is also what stops its pink masthead reading as this site's
 * own chrome. A cover with a visible edge is an object on the page. A cover
 * bled to the frame is a second brand arguing with the header.
 *
 * The file is the original at 4K, upscaled and not otherwise altered. Nothing
 * on this site is generated; see catalog.test.ts and photographs.test.ts.
 */
export const HERO_IMAGE = "/images/real/hero-cover.jpg";

/**
 * The file's own proportions, to the pixel. The hero frame is cut to these, so
 * `object-cover` has nothing to crop at any width — the alternative is picking
 * a tidy ratio like 41/75 and quietly shaving a few pixels off the masthead.
 */
export const HERO_ASPECT = "2000 / 3645";

/**
 * The three plates lined up across the top of the home page, asked for by
 * name: the yellow studio sitting that opened the site's first version, the
 * Frutera set under the plaster arches between them, and the cover. Each is
 * shown at its file's own proportions — two of the three are laid-out print
 * and portraiture, and cropping either cuts a picture somebody composed.
 *
 * The aspect strings are the files' pixel dimensions, to the pixel, for the
 * same reason HERO_ASPECT is.
 */
/**
 * The woven ground behind the hero's ink. This one is NOT a photograph and is
 * not treated as one: it is an abstract texture — near-black cloth with a few
 * marigold threads — generated to order (Higgsfield, 2026-09-01) at the
 * owner's request, and it pictures nothing: no garment, no person, no work of
 * Daysi's. The no-generated-imagery rule in photographs.test.ts is about her
 * catalogue, and this sits outside it the way a paint colour would.
 */
export const HERO_BACKDROP = "/images/texture/hero-weave.jpg";

export const HERO_PLATES = [
  {
    src: "/images/real/hero-yellow.jpg",
    aspect: "1461 / 1810",
    altKey: "plateYellowAlt",
    captionKey: "plateYellowCaption",
  },
  {
    src: "/images/real/frutera-basket.jpg",
    aspect: "848 / 1264",
    altKey: "plateBasketAlt",
    captionKey: "plateBasketCaption",
  },
  {
    src: HERO_IMAGE,
    aspect: HERO_ASPECT,
    altKey: "heroImageAlt",
    captionKey: "plateCoverCaption",
  },
] as const;
