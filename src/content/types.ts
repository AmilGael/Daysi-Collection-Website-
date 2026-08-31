import type { Locale } from "@/i18n/routing";

/**
 * The data model behind the site, one type per entity in the project ERD.
 *
 * The ERD stores bilingual fields as `name_en` / `name_es` column pairs. Here
 * they are a single `Localized` value, which keeps the two languages
 * structurally impossible to get out of step — a missing translation is a type
 * error rather than a blank space on the page.
 */
export type Localized = { readonly en: string; readonly es: string };

export function translate(value: Localized, locale: Locale): string {
  return value[locale];
}

/** US dollars in whole cents. Money is never a float anywhere in this codebase. */
export type Cents = number;

// ── Catalog ────────────────────────────────────────────────────────────────

/** ERD: DESIGN_CATEGORY — powers "filter by design". */
export type DesignCategory = {
  readonly id: string;
  readonly slug: string;
  readonly name: Localized;
  readonly blurb: Localized;
};

/** ERD: SIZE — powers "filter by size". */
export type SizeId = "s" | "m" | "l";

export type Size = {
  readonly id: SizeId;
  readonly label: string;
  readonly measurements: Localized;
  readonly sortOrder: number;
};

/** ERD: FABRIC, extended with the swatch imagery the design studio composites. */
export type Fabric = {
  readonly id: string;
  readonly name: Localized;
  readonly description: Localized;
  readonly swatchImage: string;
  /** Average colour of the swatch, used for placeholders and print styles. */
  readonly averageColor: string;
};

/**
 * ERD: PRICE_LIST_ENTRY. Prices are set per garment category and fabric, and
 * every price on the site is read from here — changing an entry changes the
 * gallery, the price list, and the estimate builder at once (PRD #15).
 */
export type PriceListEntry = {
  readonly id: string;
  readonly categoryId: string;
  readonly fabricId: string;
  readonly fixedPrice: Cents;
  readonly customizationExtra: Cents;
  readonly customizationNote: Localized;
  readonly effectiveDate: string;
};

/** ERD: STYLE_PHOTO. */
export type StylePhoto = {
  readonly src: string;
  readonly alt: Localized;
  readonly isPrimary: boolean;
};

/** ERD: STYLE_SIZE — which sizes a style is offered in, and whether it is ready now. */
export type StyleSize = {
  readonly sizeId: SizeId;
  readonly inStock: boolean;
};

/** ERD: GARMENT_STYLE — one card in the gallery. */
export type GarmentStyle = {
  readonly id: string;
  readonly slug: string;
  readonly name: Localized;
  readonly categoryId: string;
  readonly priceEntryId: string;
  readonly color: Localized;
  readonly description: Localized;
  readonly detail: Localized;
  readonly sizes: readonly StyleSize[];
  readonly photos: readonly StylePhoto[];
  readonly customizationAvailable: boolean;
  readonly isPublished: boolean;
  /** Set when the piece belongs to a limited-edition premiere. */
  readonly premiereId?: string;
};

// ── Services, alterations and appointments ─────────────────────────────────

export type Service = {
  readonly id: string;
  readonly slug: string;
  readonly name: Localized;
  readonly promise: Localized;
  readonly description: Localized;
  readonly includes: readonly Localized[];
  readonly image: string;
};

/**
 * A named alteration at a fixed price. This is the list Daysi wants clients to
 * read before they ask, so her most profitable service stops being invisible.
 */
export type AlterationService = {
  readonly id: string;
  readonly name: Localized;
  readonly description: Localized;
  readonly fixedPrice: Cents;
  readonly rushSurcharge: Cents;
  readonly turnaround: Localized;
};

/**
 * A bookable consultation. Sessions are 30 or 60 minutes; anything past the
 * booked length is billed at `overtimeRatePerHalfHour`, which the terms make
 * explicit before a client confirms.
 */
export type AppointmentType = {
  readonly id: string;
  readonly minutes: 30 | 60;
  readonly name: Localized;
  readonly description: Localized;
  readonly fee: Cents;
  readonly depositDue: Cents;
  readonly overtimeRatePerHalfHour: Cents;
  readonly suitedFor: readonly Localized[];
};

// ── Limited-edition premieres ──────────────────────────────────────────────

/**
 * Five or six pieces released every three months, previewed ahead of the
 * release the way a fashion house shows a season before it ships.
 */
export type Premiere = {
  readonly id: string;
  readonly slug: string;
  readonly season: Localized;
  readonly title: Localized;
  readonly story: Localized;
  readonly inspiration: Localized;
  readonly revealDate: string;
  readonly releaseDate: string;
  readonly piecesPlanned: number;
  readonly editionSize: number;
  readonly coverImage: string;
  readonly styleIds: readonly string[];
};

// ── Site-wide settings ─────────────────────────────────────────────────────

/** ERD: BUSINESS_INFO — a single record of everything shown in the header, footer and Google section. */
export type BusinessInfo = {
  readonly legalName: string;
  readonly displayName: string;
  readonly tagline: Localized;
  readonly foundedYear: number;
  readonly serviceArea: Localized;
  readonly neighborhood: string;
  readonly addressNote: Localized;
  readonly hours: readonly { readonly day: Localized; readonly opens: string; readonly closes: string | null }[];
  /**
   * Daysi's number, and the only field that holds it.
   *
   * There is deliberately no `phone` beside this. The number is never printed
   * on the site — it exists so `whatsappLink()` can build a `wa.me` href, and
   * nothing else. A second field holding the same digits would sooner or later
   * be rendered by someone reaching for "the phone number", so the field a
   * person would reach for does not exist. See `lib/whatsapp.ts`, and the
   * smoke check that fails if the digits ever appear outside a wa.me link.
   */
  readonly whatsapp: string;
  readonly email: string;
  readonly google: {
    readonly profileUrl: string;
    readonly directionsUrl: string;
    readonly reviewUrl: string;
    readonly mapEmbedUrl: string;
    readonly rating: number;
    readonly reviewCount: number;
  };
  readonly social: {
    readonly instagram: string | null;
    readonly youtube: string | null;
    readonly tiktok: string | null;
    readonly facebook: string | null;
  };
};

/**
 * ERD: GALLERY_WORK. A finished piece Daysi has made, shown as portfolio
 * rather than stock — no size, no price, nothing to add to a basket.
 */
export type GalleryCategoryId =
  | "runway"
  | "commissions"
  | "bridal"
  | "accessories"
  | "press"
  | "workroom";

export type GalleryWork = {
  readonly id: string;
  readonly src: string;
  /** Intrinsic size, so the grid can hold the space before the file arrives. */
  readonly width: number;
  readonly height: number;
  readonly category: GalleryCategoryId;
  readonly caption: Localized;
};
