import type { FabricChange } from "@/lib/office-validation";

/**
 * What the fabric cards and their sheet know about one bolt, and how a new
 * one becomes a draft change. Pure: the components call these and stage the
 * result. Kept out of `fabric-manager.tsx` so the sheet can import the type
 * without importing the card grid that renders it — the cycle a reviewer
 * caught on the gallery pass.
 */

/**
 * The four garment categories a fabric can be priced for — the same ids
 * Precios groups its "Prendas, por tela" table by. Fixed, so nothing here
 * ever needs a fifth.
 */
export const FABRIC_CATEGORIES = ["dresses", "pants", "shirts", "heritage"] as const;
export type FabricCategory = (typeof FABRIC_CATEGORIES)[number];

export type ManagedFabric = {
  readonly id: string;
  readonly name: string;
  readonly swatchImage: string;
  readonly custom: boolean;
  /** Cents per category this fabric is offered in, read from the live price list. */
  readonly prices: Readonly<Partial<Record<FabricCategory, number>>>;
};

export function fabricKey(id: string): string {
  return `fabric:${id}`;
}

/**
 * One number to show for a fabric: the least any garment made in it costs.
 * `varies` is true when its categories do not all share that one price —
 * true of most fabrics the site shipped with (Precios prices a pair at a
 * time), never of a fabric added since 14 September 2026, when adding one
 * started writing the same price into every pair at once.
 */
export function representativePrice(
  prices: ManagedFabric["prices"],
): { readonly cents: number; readonly varies: boolean } | null {
  const values = FABRIC_CATEGORIES.flatMap((category) => {
    const cents = prices[category];
    return cents === undefined ? [] : [cents];
  });
  if (values.length === 0) return null;
  return { cents: Math.min(...values), varies: new Set(values).size > 1 };
}

/**
 * A brand-new fabric's wire: one figure, written into every category pair at
 * once (decided with Daysi on 14 September 2026), rather than the four the
 * sheet used to ask for. The schema and the action stay as they are —
 * `fabric-add` still carries all four, they just always agree.
 */
export function fabricAddWire(
  key: string,
  name: string,
  swatchImage: string,
  averageColor: string,
  cents: number,
): FabricChange {
  return {
    type: "fabric-add",
    key,
    name,
    swatchImage,
    averageColor,
    prices: Object.fromEntries(
      FABRIC_CATEGORIES.map((category) => [category, cents]),
    ) as Record<FabricCategory, number>,
  };
}

/** A fabric's per-category prices, read off the live price list by its id. */
export function pricesFromEntries(
  fabricId: string,
  entries: readonly {
    readonly fabricId: string;
    readonly categoryId: string;
    readonly fixedPrice: number;
  }[],
): ManagedFabric["prices"] {
  const prices: Partial<Record<FabricCategory, number>> = {};
  for (const entry of entries) {
    if (entry.fabricId !== fabricId) continue;
    if ((FABRIC_CATEGORIES as readonly string[]).includes(entry.categoryId)) {
      prices[entry.categoryId as FabricCategory] = entry.fixedPrice;
    }
  }
  return prices;
}
