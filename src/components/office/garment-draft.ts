import type { CollectionChange } from "@/lib/office-validation";
import { type PhotoSlot } from "@/lib/photo-order";
import type { DraftChange } from "./use-office-draft";

/**
 * What the sheet knows about one garment, and how its state becomes a draft
 * change. Pure: the components call these and stage the result.
 */

export type SizeId = "s" | "m" | "l";
const SIZES: readonly SizeId[] = ["s", "m", "l"];
/** Pieces left per size once counted; the older on/off switch for a size never counted. */
export type Stock = Record<SizeId, boolean | number>;
/** A garment's own price in cents; a null extra is the list's made-to-measure charge. */
export type OwnPriceView = { readonly fixedPrice: number; readonly customizationExtra: number | null };

export type ManagedStyle = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  /** Cents, what the site charges now: its own price, else the list's; null when the pair has none. */
  readonly price: number | null;
  /** Cents, the list price of its garment-and-cloth pair; null when the pair has none. */
  readonly listPrice: number | null;
  /** Cents, the list's made-to-measure extra for that pair; null when the pair has none. */
  readonly listExtra: number | null;
  /** The price Daysi set for this garment alone; null when it follows the list. */
  readonly ownPrice: OwnPriceView | null;
  /** Current order, cover first, as the site shows it now. */
  readonly photos: readonly string[];
  readonly isPublished: boolean;
  readonly inStudio: boolean;
  readonly sizes: readonly { readonly sizeId: SizeId; readonly inStock: boolean; readonly count?: number }[];
  readonly retired: boolean;
  readonly undoable: boolean;
  readonly texts: {
    readonly name: { readonly es: string; readonly en: string };
    readonly color: { readonly es: string; readonly en: string };
    readonly description: { readonly es: string; readonly en: string };
    readonly detail: { readonly es: string; readonly en: string };
  };
  readonly codedTexts: ManagedStyle["texts"];
};

export type OverrideView = {
  readonly isPublished: boolean;
  readonly inStudio: boolean;
  readonly stock: Stock;
  /** Counts an undo is bringing back, with the moment each was taken. */
  readonly countedAt?: Readonly<Partial<Record<SizeId, string>>>;
  readonly slots: readonly PhotoSlot[];
  readonly ownPrice: OwnPriceView | null;
};

type OverrideWire = Extract<CollectionChange, { type: "style-override" }>;

export function overrideKey(styleId: string): string {
  return `style:${styleId}`;
}

function stockOf(row: ManagedStyle): Stock {
  const stock: Stock = { s: false, m: false, l: false };
  for (const size of row.sizes) stock[size.sizeId] = size.count ?? size.inStock;
  return stock;
}

/** She typed a count for one size: it is counted now, whatever an undo had brought back. */
export function withCount(view: OverrideView, size: SizeId, count: number): OverrideView {
  const { [size]: _dropped, ...countedAt } = view.countedAt ?? {};
  return { ...view, stock: { ...view.stock, [size]: count }, countedAt };
}

/** The sheet's state: the pending change if there is one, otherwise the saved row. */
export function viewOf(row: ManagedStyle, pending: DraftChange<CollectionChange> | undefined): OverrideView {
  const wire = pending?.wire.type === "style-override" ? pending.wire : undefined;
  const slots = Array.isArray(pending?.meta) ? (pending!.meta as readonly PhotoSlot[]) : undefined;
  return {
    isPublished: wire?.isPublished ?? row.isPublished,
    inStudio: wire?.inStudio ?? row.inStudio,
    stock: { ...stockOf(row), ...(wire?.stock ?? {}) },
    ...(wire?.countedAt ? { countedAt: wire.countedAt } : {}),
    slots: slots ?? (wire?.photos ?? row.photos).map((src) => ({ kind: "src", src })),
    // Unlike the stock, a pending line is the whole truth about the price:
    // one without it (an undo, say) puts the list price back.
    ownPrice: wire
      ? wire.fixedPrice === undefined
        ? null
        : { fixedPrice: wire.fixedPrice, customizationExtra: wire.customizationExtra ?? null }
      : row.ownPrice,
  };
}

/**
 * Only the sizes she changed, or whose count an undo is bringing back: the
 * rest stay off the wire, so the server keeps their number and the moment
 * it was counted, and a sale made while this page was open still counts.
 */
function changedStock(row: ManagedStyle, view: OverrideView): Pick<OverrideWire, "stock" | "countedAt"> {
  const saved = stockOf(row);
  const stock: Partial<Stock> = {};
  const countedAt: Partial<Record<SizeId, string>> = {};
  for (const size of SIZES) {
    const at = view.countedAt?.[size];
    if (view.stock[size] === saved[size] && at === undefined) continue;
    stock[size] = view.stock[size];
    if (at !== undefined && typeof view.stock[size] === "number") countedAt[size] = at;
  }
  return Object.keys(countedAt).length > 0 ? { stock, countedAt } : { stock };
}

/** One draft change for the garment: srcs on the wire now, files uploaded at confirm and put back in slot order. */
export function overrideChange(row: ManagedStyle, view: OverrideView): DraftChange<CollectionChange> {
  const wire: OverrideWire = {
    type: "style-override",
    key: overrideKey(row.id),
    styleId: row.id,
    isPublished: view.isPublished,
    ...changedStock(row, view),
    photos: view.slots.flatMap((slot) => (slot.kind === "src" ? [slot.src] : [])),
    inStudio: view.inStudio,
    // Every line carries the own price it should keep; one left off is cleared.
    ...(view.ownPrice === null
      ? {}
      : {
          fixedPrice: view.ownPrice.fixedPrice,
          ...(view.ownPrice.customizationExtra === null ? {} : { customizationExtra: view.ownPrice.customizationExtra }),
        }),
  };
  const files = view.slots.flatMap((slot) => (slot.kind === "file" ? [slot.file] : []));
  if (files.length === 0) return { wire, meta: view.slots };
  return {
    wire,
    files,
    meta: view.slots,
    withUploads: (srcs) => {
      let next = 0;
      return {
        ...wire,
        photos: view.slots.map((slot) => (slot.kind === "src" ? slot.src : (srcs[next++] ?? ""))).filter((src) => src.length > 0),
      };
    },
  };
}

/** True when confirming would change nothing, so the entry can leave the draft. */
export function unchanged(view: OverrideView, row: ManagedStyle): boolean {
  const saved = stockOf(row);
  return (
    view.isPublished === row.isPublished &&
    view.inStudio === row.inStudio &&
    SIZES.every((size) => view.stock[size] === saved[size] && view.countedAt?.[size] === undefined) &&
    view.slots.length === row.photos.length &&
    view.slots.every((slot, index) => slot.kind === "src" && slot.src === row.photos[index]) &&
    view.ownPrice?.fixedPrice === row.ownPrice?.fixedPrice &&
    view.ownPrice?.customizationExtra === row.ownPrice?.customizationExtra
  );
}

/** Cents as a price box shows them, the way the Prices tab does: 295.00. */
export function inBox(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * The new-garment sheet's price, as typed: the own-price switch and its two
 * boxes (the price box doubles as the list price for a pair with none).
 */
export type NewPriceBoxes = { readonly own: boolean; readonly price: string; readonly extra: string };

/**
 * Where the boxes start, and where a change of garment or cloth puts them
 * back: a number typed for one pair is never another pair's price, on the
 * list or on this garment.
 */
export const clearedPrice: NewPriceBoxes = { own: false, price: "", extra: "" };

/**
 * The own-price switch on a priced pair. On, the price box starts from the
 * list price of the pair on screen, for her to change, and the extra box is
 * empty, which keeps the list's charge (shown as its placeholder), as on an
 * existing garment's sheet. Off, both boxes empty.
 */
export function ownPriceSwitched(on: boolean, listPrice: number): NewPriceBoxes {
  return on ? { own: true, price: inBox(listPrice), extra: "" } : clearedPrice;
}
