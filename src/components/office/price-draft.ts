/**
 * What the Precios rows and their sheets know about one garment price, one
 * alteration or one session, and the keys their changes stage under. Kept
 * out of `price-manager.tsx` so the sheets can import these types without
 * importing the row list that renders them — the cycle a reviewer caught on
 * the gallery pass.
 */

export type ManagedEntry = {
  readonly id: string;
  /** Groups this entry under its category's collapsible header. */
  readonly categoryId: string;
  readonly garment: string;
  readonly fabric: string;
  readonly fabricSwatch: string;
  readonly fixedPrice: number;
  readonly customizationExtra: number;
  /** Garments on this entry that carry their own price instead of it. */
  readonly ownPriced: number;
  readonly retired: boolean;
  readonly undoable: boolean;
};

/** `coded` ones shipped with the site and can only be repriced; the rest she added. */
export type ManagedAlteration = {
  readonly id: string;
  readonly name: string;
  readonly fixedPrice: number;
  readonly rushSurcharge: number;
  readonly coded: boolean;
  readonly undoable: boolean;
};
export type ManagedAppointment = {
  readonly id: string;
  readonly name: string;
  readonly fee: number;
  readonly coded: boolean;
  readonly undoable: boolean;
};
export type RetiredService = { readonly id: string; readonly name: string };

/** One garment category's fabrics, in the order Precios groups them. */
export type PriceCategoryGroup = {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly ManagedEntry[];
};

export const entryKey = (id: string): string => `entry:${id}`;
export const alterationKey = (id: string): string => `alteration:${id}`;
export const appointmentKey = (id: string): string => `appointment:${id}`;
