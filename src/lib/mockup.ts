import type { Silhouette } from "@/content/silhouettes";

/**
 * Draws a garment mockup: a croquis figure, the chosen cloth clipped into the
 * garment panels, soft shading so the cloth reads as fabric on a body rather
 * than a flat sticker, and the seam lines over the top.
 *
 * It is a sketch and says so on the page. Print placement is still decided on
 * the table with the cloth in hand — this exists so a client can see whether a
 * print does what they hoped before anything is cut.
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

export function drawMockup(context: CanvasRenderingContext2D, options: MockupOptions): void {
  const { silhouette, fabric, printScale, trimColor, background } = options;

  context.save();
  context.clearRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);
  context.fillStyle = background;
  context.fillRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);

  drawCroquis(context);

  const pattern = context.createPattern(fabric, "repeat");
  if (pattern) {
    // The swatch is square; scaling the pattern rather than the canvas keeps
    // the garment the same size while the print grows or shrinks inside it.
    const size = (fabric.naturalWidth || 1) / (240 * printScale);
    pattern.setTransform(new DOMMatrix().scaleSelf(1 / size));
  }

  for (const outline of silhouette.panels) {
    const panel = new Path2D(outline);

    context.save();
    context.clip(panel);
    context.fillStyle = pattern ?? "#cccccc";
    context.fillRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);
    context.fillStyle = shadingGradient(context);
    context.fillRect(0, 0, MOCKUP_WIDTH, MOCKUP_HEIGHT);
    context.restore();

    context.strokeStyle = trimColor;
    context.lineWidth = 2;
    context.stroke(panel);
  }

  context.strokeStyle = trimColor;
  context.lineWidth = 1.25;
  context.globalAlpha = 0.55;
  for (const seam of silhouette.seams) {
    context.stroke(new Path2D(seam));
  }
  context.globalAlpha = 1;

  context.restore();
}

/** A light-from-the-left fall of shadow, the same on every silhouette. */
function shadingGradient(context: CanvasRenderingContext2D): CanvasGradient {
  const gradient = context.createLinearGradient(150, 0, 470, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0.16)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(20,17,13,0.22)");
  return gradient;
}

/** The figure under the clothes: head, neck, arms and legs, drawn faintly. */
function drawCroquis(context: CanvasRenderingContext2D): void {
  context.save();
  context.strokeStyle = "rgba(20,17,13,0.22)";
  context.fillStyle = "rgba(20,17,13,0.06)";
  context.lineWidth = 1.5;

  const head = new Path2D();
  head.ellipse(300, 118, 34, 42, 0, 0, Math.PI * 2);
  context.fill(head);
  context.stroke(head);

  const figure = new Path2D(
    // Neck and shoulders, then arms down the sides, then legs to the hem.
    "M286 158 L286 190 M314 158 L314 190 " +
      "M240 196 L200 380 M360 196 L400 380 " +
      "M272 330 L268 760 M328 330 L332 760",
  );
  context.stroke(figure);
  context.restore();
}
