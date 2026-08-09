import type { Panel, PanelKind, Silhouette } from "@/content/silhouettes";
import { drawFigure, drawForearms, lightGradient } from "./croquis";

/**
 * Draws a garment mockup as a make-believe 3D illustration: the croquis
 * figure standing in soft studio light, with the chosen cloth wrapped around
 * her rather than pasted on flat.
 *
 * The third dimension is faked with three honest tricks, all in plain canvas
 * so the page stays self-contained under its Content-Security-Policy:
 *
 * 1. Cylinder mapping. Each panel is painted in vertical slices, and the
 *    slices near the silhouette's edges consume more of the source pattern
 *    than they display — the print visibly compresses as the body turns away,
 *    exactly what a repeat does on a real torso.
 * 2. Drape. Edge slices drop a few pixels, so hems and pattern rows bow the
 *    way cloth hangs on a cylinder instead of running flat across it.
 * 3. One light. The same upper-left light that shades the figure's skin lays
 *    a highlight and a falling shadow across every panel, and authored fold
 *    lines put creases where the cut would make them.
 *
 * It remains a sketch and the page says so — print placement is still decided
 * on the table with the cloth in hand.
 */

export const MOCKUP_WIDTH = 600;
export const MOCKUP_HEIGHT = 820;

export type MockupOptions = {
  readonly silhouette: Silhouette;
  readonly fabric: HTMLImageElement;
  /** How large the print reads on the garment. 1 is the cloth at true scale. */
  readonly printScale: number;
  readonly trimColor: string;
  readonly background: string;
};

/** How tightly the print wraps around each kind of volume. */
const CURVATURE: Record<PanelKind, number> = {
  bodice: 0.8,
  skirt: 0.5,
  sleeve: 0.92,
  band: 0.9,
  pantleg: 0.75,
  headwrap: 0.94,
};

/** How far the cloth drops at the silhouette's edges, in pixels. */
const DRAPE_DROP: Record<PanelKind, number> = {
  bodice: 6,
  skirt: 14,
  sleeve: 4,
  band: 3,
  pantleg: 10,
  headwrap: 2,
};

const SLICES = 44;
const INK = "rgba(20, 17, 13,";

export type CylinderSlice = {
  /** Position across the panel, -1 at the left edge to 1 at the right. */
  readonly t: number;
  /** Foreshortening at this slice; 1 face-on, smaller as the surface turns. */
  readonly wrapCos: number;
  /** How much source pattern one displayed pixel consumes here. */
  readonly sourceScale: number;
};

/**
 * The cylinder profile the slices follow. Pure so it can be tested: the
 * profile must be symmetric, flattest in the middle, and hungriest for source
 * pattern at the edges.
 */
export function cylinderProfile(slices: number, curvature: number): CylinderSlice[] {
  return Array.from({ length: slices }, (_, index) => {
    const t = ((index + 0.5) / slices) * 2 - 1;
    const wrapCos = Math.sqrt(Math.max(1 - curvature * t * t, 0.08));
    return { t, wrapCos, sourceScale: 1 / wrapCos };
  });
}

/**
 * The fabric tiled once into an offscreen canvas that shares the mockup's
 * coordinate space, so every panel samples from the same continuous cloth.
 * Wide enough that edge slices can reach for extra pattern without running
 * off the end.
 */
function tilePattern(fabric: HTMLImageElement, printScale: number): HTMLCanvasElement {
  const tile = Math.max(48, Math.round(240 * printScale));
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = MOCKUP_HEIGHT + 60;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      context.drawImage(fabric, x, y, tile, tile);
    }
  }
  return canvas;
}

function fillWrapped(
  context: CanvasRenderingContext2D,
  panel: Panel,
  pattern: HTMLCanvasElement,
): void {
  const { x, y, w, h } = panel.bounds;
  const path = new Path2D(panel.d);
  const drop = DRAPE_DROP[panel.kind];
  const profile = cylinderProfile(SLICES, CURVATURE[panel.kind]);

  context.save();
  context.clip(path);

  const sliceWidth = w / SLICES;
  let sourceX = x;
  for (let index = 0; index < SLICES; index += 1) {
    const slice = profile[index]!;
    const dx = x + index * sliceWidth;
    const dy = y + (1 - slice.wrapCos) * drop;
    const sourceWidth = Math.min(sliceWidth * slice.sourceScale, pattern.width - sourceX - 1);
    context.drawImage(
      pattern,
      sourceX,
      Math.max(y, 0),
      Math.max(sourceWidth, 1),
      h,
      dx,
      dy,
      sliceWidth + 1.2,
      h,
    );
    sourceX += Math.max(sourceWidth, 1);
  }

  // The shared light falls across the wrapped cloth.
  context.fillStyle = lightGradient(context, x, w, 1.4);
  context.fillRect(x, y - drop, w, h + drop * 2);
  context.restore();
}

function strokeSoft(
  context: CanvasRenderingContext2D,
  d: string,
  width: number,
  alpha: number,
): void {
  context.save();
  context.strokeStyle = `${INK} ${alpha})`;
  context.lineWidth = width;
  context.lineCap = "round";
  context.stroke(new Path2D(d));
  context.restore();
}

export function drawMockup(context: CanvasRenderingContext2D, options: MockupOptions): void {
  const { silhouette, fabric, printScale, trimColor, background } = options;

  context.save();
  context.clearRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);
  context.fillStyle = background;
  context.fillRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);

  // A quiet studio behind her: the corners fall away a little.
  const vignette = context.createRadialGradient(300, 340, 120, 300, 380, 540);
  vignette.addColorStop(0, "rgba(20, 17, 13, 0)");
  vignette.addColorStop(1, "rgba(20, 17, 13, 0.07)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);

  drawFigure(context);

  // Plain ink pieces under the fabric garment — a top beneath pants, shorts
  // beneath an open shirt — so the figure is dressed, not modelling underwear.
  for (const underlayer of silhouette.underlayers) {
    const path = new Path2D(underlayer);
    context.save();
    context.fillStyle = "#1b1712";
    context.fill(path);
    context.clip(path);
    context.fillStyle = lightGradient(context, 230, 140, 0.8);
    context.fillRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);
    context.restore();
  }

  const pattern = tilePattern(fabric, printScale);
  for (const panel of silhouette.panels) {
    fillWrapped(context, panel, pattern);
    strokeSoft(context, panel.d, 1.1, 0.32);
  }

  // Creases where the cut would put them, drawn twice: a wide whisper of
  // shadow and a narrower core.
  for (const fold of silhouette.folds) {
    strokeSoft(context, fold, 16, 0.06);
    strokeSoft(context, fold, 6, 0.08);
  }

  // Construction lines in the chosen trim colour.
  context.save();
  context.strokeStyle = trimColor;
  context.globalAlpha = 0.85;
  context.lineWidth = 1.75;
  context.lineCap = "round";
  for (const seam of silhouette.seams) {
    context.stroke(new Path2D(seam));
  }
  context.restore();

  // Her hands come back in front of the skirt.
  drawForearms(context);

  context.restore();
}
