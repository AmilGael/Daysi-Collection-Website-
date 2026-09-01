import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fabrics } from "./catalog";
import { galleryWorks } from "./gallery";
import { premieres } from "./premieres";
import { services } from "./index";
import { styles } from "./styles";
import { HERO_BACKDROP, HERO_IMAGE } from "./photographs";

/**
 * Every photograph on this site is one Daysi owns. Nothing here is generated,
 * and the tests that keep it that way live in catalog.test.ts.
 *
 * What these check is the other half: that the file is actually on disk, and
 * that the one photograph carrying the whole first screen is large enough to
 * survive being shown at that size. The home page used to load a 1461px file
 * into a slot 2560 device pixels wide and enlarge it two and a third times to
 * fill a landscape frame, which is why she looked soft.
 */

const publicRoot = path.join(process.cwd(), "public");

function onDisk(src: string): boolean {
  return fs.existsSync(path.join(publicRoot, src.replace(/^\//, "")));
}

/**
 * Width and height straight out of the JPEG. Walks the segment markers to the
 * start-of-frame, which is the only place the real dimensions are recorded —
 * a file's byte count says nothing about how many pixels are in it.
 */
function jpegSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(file);
  let at = 2; // past the SOI marker
  while (at < bytes.length - 1) {
    if (bytes[at] !== 0xff) throw new Error(`not a JPEG segment at ${at} in ${file}`);
    const marker = bytes[at + 1]!;
    // SOF0 through SOF15, skipping the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error(`no frame header in ${file}`);
}

describe("the photographs the site names", () => {
  const referenced = [
    HERO_IMAGE,
    ...styles.flatMap((style) => style.photos.map((photo) => photo.src)),
    ...fabrics.map((fabric) => fabric.swatchImage),
    ...premieres.map((premiere) => premiere.coverImage),
    ...services.map((service) => service.image),
    ...galleryWorks.map((work) => work.src),
  ];

  it("has more than a handful to check", () => {
    expect(referenced.length).toBeGreaterThan(30);
  });

  it("are all on disk", () => {
    expect(referenced.filter((src) => !onDisk(src))).toEqual([]);
  });

  it("are all real photographs rather than anything generated", () => {
    const invented = referenced.filter(
      (src) => !src.startsWith("/images/real/") && !src.startsWith("/images/gallery/"),
    );
    expect(invented).toEqual([]);
  });
});

describe("the photograph on the first screen", () => {
  /**
   * The hero holds one half of a full-height split on a 2x display, so roughly
   * 1500 CSS pixels of a 2560-wide screen, which is 1500 device pixels of
   * width at 1x and 3000 at 2x. 2000 is the floor below which it is visibly
   * soft on a laptop, and it is a floor rather than an exact size so a better
   * file from Daysi never fails this.
   */
  it("is large enough not to be enlarged", () => {
    const { width } = jpegSize(path.join(publicRoot, HERO_IMAGE.replace(/^\//, "")));
    expect(width).toBeGreaterThanOrEqual(2000);
  });

  it("is taller than it is wide, because the layout gives it a portrait frame", () => {
    const { width, height } = jpegSize(path.join(publicRoot, HERO_IMAGE.replace(/^\//, "")));
    expect(height).toBeGreaterThan(width);
  });
});

describe("the woven ground behind the hero", () => {
  /**
   * The backdrop opts out of the catalogue rules above on purpose — it is an
   * abstract texture, not a photograph of anything — but opting out of the
   * whitelist must not mean opting out of existing. It sits in an aria-hidden
   * frame at low opacity under a gradient, so a missing file renders as
   * nothing at all: no 404 a reader would see, no test that would notice.
   * This is that test.
   */
  it("is on disk", () => {
    expect(onDisk(HERO_BACKDROP)).toBe(true);
  });

  it("lives outside the real-photograph directories, so the rule above stays honest", () => {
    expect(HERO_BACKDROP.startsWith("/images/texture/")).toBe(true);
  });
});
