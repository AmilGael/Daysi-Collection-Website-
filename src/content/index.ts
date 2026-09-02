import { categories, fabrics, sizes } from "./catalog";
import {
  alterationServices,
  appointmentTypes,
  commissionDepositRate,
  consultationCreditDays,
  priceList,
} from "./price-list";
import { premieres, services } from "./premieres";
import { styles } from "./styles";
import type {
  AlterationService,
  AppointmentType,
  DesignCategory,
  Fabric,
  GarmentStyle,
  Premiere,
  PriceListEntry,
  Service,
  SizeId,
} from "./types";

export * from "./types";
export { business, googleProfileVerified } from "./business";
export {
  alterationServices,
  appointmentTypes,
  categories,
  commissionDepositRate,
  consultationCreditDays,
  fabrics,
  premieres,
  priceList,
  services,
  sizes,
  styles,
};

/**
 * Lookups over the content above. Everything the pages need goes through one of
 * these, so a broken reference surfaces here rather than as a blank price.
 */

export function findCategory(id: string): DesignCategory | undefined {
  return categories.find((category) => category.id === id);
}

export function findFabric(id: string): Fabric | undefined {
  return fabrics.find((fabric) => fabric.id === id);
}

export function findPriceEntry(id: string): PriceListEntry | undefined {
  return priceList.find((price) => price.id === id);
}

export function findStyle(slug: string): GarmentStyle | undefined {
  return styles.find((style) => style.slug === slug && style.isPublished);
}

export function findService(slug: string): Service | undefined {
  return services.find((service) => service.slug === slug);
}

export function findPremiere(slug: string): Premiere | undefined {
  return premieres.find((premiere) => premiere.slug === slug);
}

export function findAlteration(id: string): AlterationService | undefined {
  return alterationServices.find((alteration) => alteration.id === id);
}

export function findAppointmentType(id: string): AppointmentType | undefined {
  return appointmentTypes.find((type) => type.id === id);
}

export function publishedStyles(): readonly GarmentStyle[] {
  return styles.filter((style) => style.isPublished);
}

/**
 * The gallery filter. An empty filter means "show everything", which is what
 * the page starts on.
 */
export function filterStyles(filter: {
  categoryId?: string | null;
  sizeId?: SizeId | null;
  inStockOnly?: boolean;
}): readonly GarmentStyle[] {
  return publishedStyles().filter((style) => {
    if (filter.categoryId && style.categoryId !== filter.categoryId) return false;
    if (filter.sizeId) {
      const offered = style.sizes.find((size) => size.sizeId === filter.sizeId);
      if (!offered) return false;
      if (filter.inStockOnly && !offered.inStock) return false;
    } else if (filter.inStockOnly) {
      if (!style.sizes.some((size) => size.inStock)) return false;
    }
    return true;
  });
}

export function stylesInPremiere(premiere: Premiere): readonly GarmentStyle[] {
  return premiere.styleIds
    .map((id) => styles.find((style) => style.id === id))
    .filter((style): style is GarmentStyle => style !== undefined);
}

export function primaryPhoto(style: GarmentStyle) {
  return style.photos.find((photo) => photo.isPrimary) ?? style.photos[0];
}

export function sizeLabel(id: SizeId): string {
  return sizes.find((size) => size.id === id)?.label ?? id.toUpperCase();
}

/** The premiere that is currently open for sign-ups, if there is one. */
export function upcomingPremiere(today: Date): Premiere | undefined {
  return premieres.find((premiere) => new Date(premiere.releaseDate) > today);
}

/**
 * What the premiere pages have to show on a given day. `next` is the season
 * still to be released, if one is written down; `latest` is the most recent
 * season either way, so a page has a photograph as long as any season has
 * ever been written down; `past` is every
 * season except the next one, most recent first. The day after a release
 * there may be no next season yet, and that gap is Daysi's to fill, not a
 * fault in the code, so both pages read from here and stand on their own.
 */
export function premiereListing(today: Date): {
  next: Premiere | undefined;
  latest: Premiere | undefined;
  past: readonly Premiere[];
} {
  const next = upcomingPremiere(today);
  return {
    next,
    latest: next ?? premieres[0],
    past: premieres.filter((premiere) => premiere.id !== next?.id),
  };
}
