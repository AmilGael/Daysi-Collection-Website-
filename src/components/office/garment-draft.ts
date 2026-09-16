import type { CollectionChange } from "@/lib/office-validation";
import { type PhotoSlot } from "@/lib/photo-order";
import type { DraftChange } from "./use-office-draft";

/**
 * What the sheet knows about one garment, and how its state becomes a draft
 * change. Pure: the components call these and stage the result.
 */

export type SizeId = "s" | "m" | "l";
export type Stock = Record<SizeId, boolean>;

export type ManagedStyle = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  /** Cents, from the price list through the garment's price entry; null when the pair has none. */
  readonly price: number | null;
  /** Current order, cover first, as the site shows it now. */
  readonly photos: readonly string[];
  readonly isPublished: boolean;
  readonly inStudio: boolean;
  readonly sizes: readonly { readonly sizeId: SizeId; readonly inStock: boolean }[];
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
  readonly slots: readonly PhotoSlot[];
};

type OverrideWire = Extract<CollectionChange, { type: "style-override" }>;

export function overrideKey(styleId: string): string {
  return `style:${styleId}`;
}

function stockOf(row: ManagedStyle): Stock {
  const stock: Stock = { s: false, m: false, l: false };
  for (const size of row.sizes) stock[size.sizeId] = size.inStock;
  return stock;
}

/** The sheet's state: the pending change if there is one, otherwise the saved row. */
export function viewOf(row: ManagedStyle, pending: DraftChange<CollectionChange> | undefined): OverrideView {
  const wire = pending?.wire.type === "style-override" ? pending.wire : undefined;
  const slots = Array.isArray(pending?.meta) ? (pending!.meta as readonly PhotoSlot[]) : undefined;
  return {
    isPublished: wire?.isPublished ?? row.isPublished,
    inStudio: wire?.inStudio ?? row.inStudio,
    stock: { ...stockOf(row), ...(wire?.stock ?? {}) },
    slots: slots ?? (wire?.photos ?? row.photos).map((src) => ({ kind: "src", src })),
  };
}

/** One draft change for the garment: srcs on the wire now, files uploaded at confirm and put back in slot order. */
export function overrideChange(styleId: string, view: OverrideView): DraftChange<CollectionChange> {
  const wire: OverrideWire = {
    type: "style-override",
    key: overrideKey(styleId),
    styleId,
    isPublished: view.isPublished,
    stock: view.stock,
    photos: view.slots.flatMap((slot) => (slot.kind === "src" ? [slot.src] : [])),
    inStudio: view.inStudio,
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
    view.stock.s === saved.s &&
    view.stock.m === saved.m &&
    view.stock.l === saved.l &&
    view.slots.length === row.photos.length &&
    view.slots.every((slot, index) => slot.kind === "src" && slot.src === row.photos[index])
  );
}
