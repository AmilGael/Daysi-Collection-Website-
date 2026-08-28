/**
 * How hard the optimizer is allowed to squeeze a photograph.
 *
 * next/image defaults to 75, which is the right average for a site whose
 * pictures are decoration. Here they are the merchandise — the argument for a
 * $325 dress is the register of the print and the sheen on the silk — so the
 * default was measured rather than accepted.
 *
 * Comparing the same AVIF crop of `wax-print-shirt` at 2x, the thin white rays
 * of the wax print are visibly cleaner at 85 than at 75. Between 85 and 90 I
 * could not find a difference on any image on this site, and 90 costs another
 * 16KB on a 1200px hero (75 → 117KB, 85 → 154KB, 90 → 170KB). So: 85, the
 * point past which the extra bytes buy nothing the eye can locate.
 *
 * This is for the large photographic slots only. Office thumbnails keep the
 * default, where the difference is invisible and the page is behind a login.
 */
export const PHOTO_QUALITY = 85;
