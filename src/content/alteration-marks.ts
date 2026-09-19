/**
 * A small drawing for each alteration on the public list, in the same ink
 * line as the garments in `silhouettes.ts`: outline only, no fill, round
 * ends. Drawn on a 48 × 48 box.
 *
 * `lines` are the garment or the tool, in ink. `marks` are where the work
 * goes, the chalk line a seamstress draws before she cuts or stitches, and
 * are drawn dashed in the trim colour, as the silhouettes' seams are.
 *
 * Every coded alteration has one; alteration-marks.test.ts holds that. One
 * Daysi adds from the office shows her photo if she gave it one, and the
 * needle otherwise.
 */

export type AlterationMark = {
  readonly lines: readonly string[];
  readonly marks: readonly string[];
};

/** For an alteration with no drawing of its own: a threaded needle and a running stitch. */
export const needleMark: AlterationMark = {
  lines: [
    "M9 39 L35.9 10.9 A1.6 1.6 0 0 1 38.1 13.1 Z",
    "M33.4 15.6 L35 14",
    "M34.4 14.6 C42 19 44 28 35 31 S21 32 16 41",
  ],
  marks: ["M22 44 L42 44"],
};

export const alterationMarks: Readonly<Record<string, AlterationMark>> = {
  // A dress, the new hem chalked above the old one, and which way it goes.
  "hem-dress": {
    lines: [
      "M19 5 Q24 8.5 29 5 L30.5 18 L37 41 Q24 44 11 41 L17.5 18 Z",
      "M17.5 18 Q24 19.5 30.5 18",
      "M42.5 41 L42.5 32 M40 34.5 L42.5 32 L45 34.5",
    ],
    marks: ["M12.7 35 Q24 37.8 35.3 35"],
  },
  // Trousers, the new hem chalked across both legs.
  "hem-pants": {
    lines: [
      "M15 5 L33 5 L35 43 L27 43 L24 17 L21 43 L13 43 Z",
      "M14.8 9 L33.2 9",
      "M41.5 42 L41.5 33 M39 35.5 L41.5 33 L44 35.5",
    ],
    marks: ["M13.4 35 L21.9 35 M26.1 35 L34.6 35"],
  },
  // A skirt, taken in or let out at the waistband.
  waist: {
    lines: [
      "M16 15 L32 15 L37 42 L11 42 Z",
      "M28.4 18.5 A0.9 0.9 0 1 0 30.2 18.5 A0.9 0.9 0 1 0 28.4 18.5",
      "M9 8 L39 8 M12 5 L9 8 L12 11 M36 5 L39 8 L36 11",
    ],
    marks: ["M15.3 21.5 L32.7 21.5"],
  },
  // A bodice, the side seams chalked in to the body.
  "side-seams": {
    lines: ["M18 6 Q24 10 30 6 L37 10 L34.5 16 L32 14.5 L32 42 L16 42 L16 14.5 L13.5 16 L11 10 Z"],
    marks: ["M19 17 Q21.5 29 19 40", "M29 17 Q26.5 29 29 40"],
  },
  // A long-sleeved shirt, the new length chalked across each sleeve.
  sleeves: {
    lines: ["M18 6 Q24 9 30 6 L36 8 L42 34 L37 36 L32 18 L32 42 L16 42 L16 18 L11 36 L6 34 L12 8 Z"],
    marks: ["M7.2 29 L12.4 31", "M40.8 29 L35.6 31"],
  },
  // A zip, closed above the slider and open below it.
  zipper: {
    lines: [
      "M20 5 L20 20 M28 5 L28 20",
      "M20 8 L24 8 M24 10.5 L28 10.5 M20 13 L24 13 M24 15.5 L28 15.5 M20 18 L24 18",
      "M20 20 L28 20 L26.5 25 L21.5 25 Z",
      "M22.5 25 L22.5 32 Q24 35 25.5 32 L25.5 25",
      "M21.5 25 L15 43 M26.5 25 L33 43",
    ],
    marks: [],
  },
  // A tear, the mend chalked across it, and the needle that makes it.
  repair: {
    lines: [
      "M6 30 L11 26 L15 32 L20 25 L25 31 L29 26 L34 30",
      "M26 21 L39.2 6.2 A1.1 1.1 0 0 1 40.8 7.8 Z",
      "M39.6 7.4 C45 11 44 17 38 20 S34 25 34 30",
    ],
    marks: ["M5 28.5 L35 28.5"],
  },
  // A tape measure: the whole garment, taken again.
  resize: {
    lines: [
      "M7 30 A9 9 0 1 0 25 30 A9 9 0 1 0 7 30",
      "M13.5 30 A2.5 2.5 0 1 0 18.5 30 A2.5 2.5 0 1 0 13.5 30",
      "M16 39 L43 39 L43 34 L24.1 34",
      "M28 39 L28 36.5 M31 39 L31 37.5 M34 39 L34 36.5 M37 39 L37 37.5 M40 39 L40 36.5",
      "M30 20 L42 8 M36 8 L42 8 L42 14",
    ],
    marks: [],
  },
  // Scissors on a chalked line: a new cut for a piece she already has.
  restyle: {
    lines: [
      "M12 37 A5 5 0 1 0 22 37 A5 5 0 1 0 12 37",
      "M26 37 A5 5 0 1 0 36 37 A5 5 0 1 0 26 37",
      "M19.1 32.5 L31.9 5",
      "M28.9 32.5 L16.1 5",
      "M23.2 22 A0.8 0.8 0 1 0 24.8 22 A0.8 0.8 0 1 0 23.2 22",
    ],
    marks: ["M4 11 L44 11"],
  },
};

export function markFor(alterationId: string): AlterationMark {
  return alterationMarks[alterationId] ?? needleMark;
}
