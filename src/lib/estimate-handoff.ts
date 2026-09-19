/**
 * The hand-off from the estimate builder on /prices to the page that sends
 * what was estimated: the request form for something made from scratch or
 * an alteration, the booking page for a session.
 *
 * What was chosen travels in the address, as ids only, and is read back on
 * the other side against what the shop offers today. The address is a
 * suggestion, not an order: an id the shop no longer has is dropped, a cloth
 * the garment is not made in is dropped, and the page falls back to its own
 * defaults for whatever is missing. Nothing here is trusted for a price; the
 * server prices every submission itself.
 */

export type BuilderSelection =
  | { readonly kind: "commission"; readonly categoryId: string; readonly fabricId: string }
  | { readonly kind: "alteration"; readonly alterationIds: readonly string[]; readonly rush: boolean }
  | { readonly kind: "appointment"; readonly appointmentTypeId: string };

export type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

export type RequestPrefill = {
  readonly categoryId?: string;
  readonly fabricId?: string;
  readonly alterationIds: readonly string[];
  readonly rush: boolean;
};

export function handoffHref(selection: BuilderSelection): string {
  const query = new URLSearchParams();
  switch (selection.kind) {
    case "commission":
      query.set("kind", "commission");
      query.set("category", selection.categoryId);
      query.set("fabric", selection.fabricId);
      return `/request?${query}`;
    case "alteration":
      query.set("kind", "alteration");
      query.set("alterations", selection.alterationIds.join(","));
      if (selection.rush) query.set("rush", "1");
      return `/request?${query}`;
    case "appointment":
      query.set("type", selection.appointmentTypeId);
      return `/appointments?${query}`;
  }
}

/**
 * What the request form should open on. `alteration` (one id) is what an
 * alteration card on /alterations sends; `alterations` (a list) is what the
 * builder sends, in the order the client picked them. The list is read
 * first, then the single id, with repeats dropped.
 */
export function requestPrefill(
  query: Query,
  known: {
    readonly categoryIds: readonly string[];
    readonly fabricIds: readonly string[];
    readonly alterationIds: readonly string[];
    readonly priced: (categoryId: string, fabricId: string) => boolean;
  },
): RequestPrefill {
  const category = first(query.category);
  const categoryId = category && known.categoryIds.includes(category) ? category : undefined;

  const fabric = first(query.fabric);
  const fabricId =
    categoryId && fabric && known.fabricIds.includes(fabric) && known.priced(categoryId, fabric)
      ? fabric
      : undefined;

  const asked = [...(first(query.alterations)?.split(",") ?? []), first(query.alteration)];
  const alterationIds: string[] = [];
  for (const id of asked) {
    if (id && known.alterationIds.includes(id) && !alterationIds.includes(id)) alterationIds.push(id);
  }

  return {
    ...(categoryId ? { categoryId } : {}),
    ...(fabricId ? { fabricId } : {}),
    alterationIds,
    rush: first(query.rush) === "1",
  };
}

/** The session the booking page should open on, when the address names one it offers. */
export function appointmentPrefill(query: Query, typeIds: readonly string[]): string | undefined {
  const type = first(query.type);
  return type && typeIds.includes(type) ? type : undefined;
}

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}
