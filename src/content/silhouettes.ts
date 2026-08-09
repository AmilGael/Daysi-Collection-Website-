import { mirrorPoints, smoothPathD, type Point } from "@/lib/croquis";

/**
 * Garments for the design studio, authored against the croquis figure in
 * `lib/croquis.ts` (600 × 820 canvas, figure centred on x = 300).
 *
 * Each panel names the kind of volume it wraps — a bodice hugs a torso, a
 * skirt hangs in a wide soft cone, a sleeve is a narrow cylinder — and the
 * renderer uses that to decide how strongly the print curves around it and
 * how far the hem drops at the edges. `folds` are the drawn creases that make
 * cloth read as cloth; `seams` are construction lines picked out in the trim
 * colour.
 */

export type PanelKind = "bodice" | "skirt" | "sleeve" | "band" | "pantleg" | "headwrap";

export type Panel = {
  readonly d: string;
  readonly kind: PanelKind;
  readonly bounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
};

export type Silhouette = {
  readonly id: string;
  readonly categoryId: string;
  readonly name: { readonly en: string; readonly es: string };
  /** Flat ink garments under the fabric piece — a top under pants, and so on. */
  readonly underlayers: readonly string[];
  readonly panels: readonly Panel[];
  readonly folds: readonly string[];
  readonly seams: readonly string[];
};

function panel(kind: PanelKind, points: readonly Point[], pad = 6): Panel {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    d: smoothPathD(points),
    kind,
    bounds: {
      x: minX,
      y: minY,
      w: Math.max(...xs) + pad - minX,
      h: Math.max(...ys) + pad - minY,
    },
  };
}

const shape = (points: readonly Point[]) => smoothPathD(points);

export const silhouettes: readonly Silhouette[] = [
  {
    id: "puff-sleeve-dress",
    categoryId: "dresses",
    name: { en: "Puff-sleeve dress", es: "Vestido de manga abullonada" },
    underlayers: [],
    panels: [
      panel("bodice", [
        [252, 206], [348, 206], [354, 246], [352, 308], [300, 316], [248, 308], [246, 246],
      ]),
      panel("skirt", [
        [246, 306], [354, 306], [452, 660], [382, 700], [300, 708], [218, 700], [148, 660],
      ]),
      panel("sleeve", [
        [238, 206], [200, 214], [180, 248], [186, 288], [214, 306], [242, 290], [248, 248],
      ]),
      panel("sleeve", [
        [362, 206], [400, 214], [420, 248], [414, 288], [386, 306], [358, 290], [352, 248],
      ]),
    ],
    folds: [
      "M 262 330 Q 240 520 196 660",
      "M 300 332 Q 298 520 294 690",
      "M 338 330 Q 360 520 404 660",
      "M 196 234 Q 186 262 196 288",
      "M 404 234 Q 414 262 404 288",
    ],
    seams: ["M 250 307 L 350 307", "M 254 209 L 346 209"],
  },
  {
    id: "square-neck-midi",
    categoryId: "dresses",
    name: { en: "Square-neck midi", es: "Midi de escote cuadrado" },
    underlayers: [],
    panels: [
      panel("band", [[256, 200], [272, 200], [268, 234], [252, 234]]),
      panel("band", [[344, 200], [328, 200], [332, 234], [348, 234]]),
      panel("bodice", [
        [252, 230], [348, 230], [354, 308], [300, 314], [246, 308],
      ]),
      panel("skirt", [
        [246, 306], [354, 306], [378, 636], [300, 652], [222, 636],
      ]),
    ],
    folds: ["M 276 330 Q 268 480 258 626", "M 324 330 Q 332 480 342 626"],
    seams: ["M 254 232 L 346 232", "M 250 307 L 350 307"],
  },
  {
    id: "palazzo-pants",
    categoryId: "pants",
    name: { en: "Palazzo pants", es: "Pantalón palazzo" },
    underlayers: [
      shape([[250, 202], [300, 214], [350, 202], [352, 306], [300, 312], [248, 306]]),
    ],
    panels: [
      panel("band", [[246, 298], [354, 298], [354, 330], [246, 330]]),
      panel("pantleg", [
        [246, 328], [298, 328], [297, 440], [298, 700], [250, 706], [190, 690],
      ]),
      panel("pantleg", [
        [354, 328], [302, 328], [303, 440], [302, 700], [350, 706], [410, 690],
      ]),
    ],
    folds: [
      "M 262 350 Q 248 520 224 680",
      "M 284 350 Q 282 520 278 696",
      "M 338 350 Q 352 520 376 680",
      "M 316 350 Q 318 520 322 696",
    ],
    seams: ["M 248 300 L 352 300", "M 248 329 L 352 329"],
  },
  {
    id: "camp-shirt",
    categoryId: "shirts",
    name: { en: "Camp-collar shirt", es: "Camisa cuello campero" },
    underlayers: [
      shape([[252, 300], [348, 300], [368, 520], [300, 530], [232, 520]]),
    ],
    panels: [
      panel("bodice", [
        [238, 198], [362, 198], [368, 300], [366, 438], [300, 446], [234, 438], [232, 300],
      ]),
      panel("sleeve", [
        [236, 200], [204, 208], [196, 262], [202, 296], [238, 290],
      ]),
      panel("sleeve", [
        [364, 200], [396, 208], [404, 262], [398, 296], [362, 290],
      ]),
    ],
    folds: ["M 262 260 Q 258 350 256 430", "M 338 260 Q 342 350 344 430"],
    seams: [
      "M 272 200 L 300 240 L 328 200",
      "M 272 200 L 258 226",
      "M 328 200 L 342 226",
      "M 300 242 L 300 444",
    ],
  },
  {
    id: "wrap-dress",
    categoryId: "heritage",
    name: { en: "Wrap dress and head wrap", es: "Vestido cruzado y turbante" },
    underlayers: [],
    panels: [
      panel("headwrap", [
        [250, 96], [256, 58], [300, 38], [344, 58], [350, 96], [300, 108],
      ]),
      panel("headwrap", [[288, 46], [300, 26], [314, 44], [302, 56]]),
      panel("bodice", [
        [250, 204], [350, 204], [356, 308], [300, 318], [244, 308],
      ]),
      panel("skirt", [
        [244, 306], [356, 306], [462, 668], [300, 712], [138, 668],
      ]),
    ],
    folds: [
      "M 260 330 Q 234 520 182 656",
      "M 300 334 Q 298 520 292 700",
      "M 340 330 Q 366 520 418 656",
    ],
    seams: [
      "M 258 208 L 336 300",
      "M 342 208 L 264 300",
      "M 248 307 L 352 307",
    ],
  },
];
