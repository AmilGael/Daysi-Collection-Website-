/**
 * The figure the design studio dresses.
 *
 * A fashion croquis, not a mannequin diagram: a fuller figure with real
 * shoulders, hips, hands and hair, standing on a floor that catches her
 * shadow. The house line is "made for the body you have", and the drawing a
 * client tries her cloth on should say the same thing.
 *
 * Geometry is authored as sparse keypoints and smoothed through a Catmull-Rom
 * spline, so every contour is a curve and the left side mirrors to the right
 * — tuning a hip means moving one number, not rebalancing a hand-written
 * bézier soup.
 */

export type Point = readonly [number, number];

export const CANVAS_CENTER_X = 300;

/** Catmull-Rom through the points, emitted as SVG path data. */
export function smoothPathD(points: readonly Point[], closed = true): string {
  const count = points.length;
  const at = (index: number): Point =>
    closed
      ? points[((index % count) + count) % count]!
      : points[Math.min(Math.max(index, 0), count - 1)]!;

  const start = at(0);
  let d = `M ${round(start[0])} ${round(start[1])}`;
  const segments = closed ? count : count - 1;

  for (let i = 0; i < segments; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2[0])} ${round(p2[1])}`;
  }

  return closed ? `${d} Z` : d;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function mirrorPoints(points: readonly Point[]): Point[] {
  return points.map(([x, y]): Point => [2 * CANVAS_CENTER_X - x, y]).reverse();
}

// ── The figure ─────────────────────────────────────────────────────────────

/**
 * Left half of the standing body, neck to toes; the right half is its mirror.
 * The path runs down the outside, around the foot, up the inside of the leg
 * to the inseam, then across to the mirrored right side and back to the neck.
 */
const LEFT_BODY: readonly Point[] = [
  [283, 176], // neck base
  [252, 188], // shoulder slope
  [230, 200], // shoulder tip
  [240, 246], // underarm
  [247, 278], // ribs
  [249, 308], // waist
  [232, 352], // high hip
  [221, 395], // hip
  [228, 455], // outer thigh
  [250, 560], // outer knee
  [246, 618], // outer calf
  [270, 716], // outer ankle
  [262, 742], // heel
  [287, 756], // toes
  [295, 744], // instep
  [292, 714], // inner ankle
  [288, 560], // inner knee
  [295, 470], // inner thigh
  [300, 432], // inseam
];

/** A whole arm, shoulder cap to fingertips and back up the inside. */
const LEFT_ARM: readonly Point[] = [
  [233, 198],
  [217, 232],
  [213, 290], // outer elbow
  [216, 352],
  [216, 406], // outer wrist
  [211, 450],
  [219, 468], // fingertips
  [230, 455],
  [234, 406], // inner wrist
  [243, 352],
  [246, 300], // inner elbow
  [250, 252],
  [244, 214],
];

/**
 * Elbow down only. Hands rest in front of a skirt, so after the garments are
 * painted the forearms are drawn a second time on top.
 */
const LEFT_FOREARM: readonly Point[] = [
  [213, 292],
  [216, 352],
  [216, 406],
  [211, 450],
  [219, 468],
  [230, 455],
  [234, 406],
  [243, 352],
  [245, 302],
];

const NECK: readonly Point[] = [
  [288, 136],
  [312, 136],
  [316, 200],
  [284, 200],
];

/** The halo of natural hair the head sits inside. */
const HAIR: readonly Point[] = [
  [300, 42],
  [348, 54],
  [369, 92],
  [360, 132],
  [332, 152],
  [268, 152],
  [240, 132],
  [231, 92],
  [252, 54],
];

const SKIN_BASE = "#7b4b33";
const HAIR_BASE = "#221913";
const INK = "rgba(20, 17, 13,";

function bodyPath(): Path2D {
  return new Path2D(
    smoothPathD([...LEFT_BODY, ...mirrorPoints(LEFT_BODY), [300, 173]]),
  );
}

function armPaths(): Path2D[] {
  return [
    new Path2D(smoothPathD(LEFT_ARM)),
    new Path2D(smoothPathD(mirrorPoints(LEFT_ARM))),
  ];
}

export function forearmPaths(): Path2D[] {
  return [
    new Path2D(smoothPathD(LEFT_FOREARM)),
    new Path2D(smoothPathD(mirrorPoints(LEFT_FOREARM))),
  ];
}

function headPath(): Path2D {
  const head = new Path2D();
  head.ellipse(300, 112, 33, 42, 0, 0, Math.PI * 2);
  return head;
}

/**
 * One light for the whole drawing, falling from the upper left — the same
 * side the photography is lit from. Skin, hair and cloth all shade with it.
 */
export function lightGradient(
  context: CanvasRenderingContext2D,
  x: number,
  width: number,
  strength: number,
): CanvasGradient {
  const gradient = context.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, `rgba(255, 240, 216, ${0.15 * strength})`);
  gradient.addColorStop(0.42, "rgba(255, 240, 216, 0)");
  gradient.addColorStop(0.58, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(24, 12, 6, ${0.22 * strength})`);
  return gradient;
}

export function drawFigure(context: CanvasRenderingContext2D): void {
  // Her shadow on the floor grounds the whole drawing.
  context.save();
  context.fillStyle = `${INK} 0.10)`;
  context.beginPath();
  context.ellipse(300, 762, 152, 15, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = `${INK} 0.08)`;
  context.beginPath();
  context.ellipse(300, 762, 96, 10, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Each piece of skin is its own fill, painted back to front: arms, then
  // the torso over their inner edges so they hang behind the figure, then
  // neck, then head. They must never share one compound path — the mirrored
  // halves wind in opposite directions, and the nonzero fill rule turns their
  // overlaps into holes. The shading gradient depends only on x, so the
  // pieces shade identically and no seam shows where they meet.
  for (const piece of [
    ...armPaths(),
    bodyPath(),
    new Path2D(smoothPathD(NECK)),
    headPath(),
  ]) {
    paintSkin(context, piece);
  }

  // Hair over the head, with a warm catch-light on the lit side.
  const hair = new Path2D(smoothPathD(HAIR));
  context.save();
  context.fillStyle = HAIR_BASE;
  context.fill(hair);
  context.clip(hair);
  const sheen = context.createRadialGradient(262, 70, 8, 262, 70, 110);
  sheen.addColorStop(0, "rgba(224, 168, 116, 0.16)");
  sheen.addColorStop(1, "rgba(224, 168, 116, 0)");
  context.fillStyle = sheen;
  context.fillRect(0, 0, 600, 820);
  context.restore();

  // Face inside the hair, shaded like the rest of the skin.
  const face = headPath();
  context.save();
  context.fillStyle = SKIN_BASE;
  context.fill(face);
  context.clip(face);
  context.fillStyle = lightGradient(context, 267, 66, 1.1);
  context.fillRect(0, 0, 600, 820);
  context.restore();

  // A single marigold hoop — the one piece of jewellery the house would pick.
  context.save();
  context.strokeStyle = "#e8a302";
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(336, 142, 5, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function paintSkin(context: CanvasRenderingContext2D, piece: Path2D): void {
  context.save();
  context.fillStyle = SKIN_BASE;
  context.fill(piece);
  context.clip(piece);
  context.fillStyle = lightGradient(context, 205, 190, 1);
  context.fillRect(0, 0, 600, 820);
  context.restore();
}

/** Repaints the forearms and hands over whatever the garments covered. */
export function drawForearms(context: CanvasRenderingContext2D): void {
  for (const forearm of forearmPaths()) {
    paintSkin(context, forearm);
  }
}
