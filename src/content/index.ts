import { categories, fabrics, sizes } from "./catalog";
import {
  alterationServices,
  appointmentTypes,
  commissionDepositRate,
  consultationCreditDays,
  designFee,
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
  StyleSize,
} from "./types";

export * from "./types";
export { business, googleProfileVerified } from "./business";
export {
  alterationServices,
  appointmentTypes,
  categories,
  commissionDepositRate,
  consultationCreditDays,
  designFee,
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

/**
 * What a size says beside it. A counted size with none left is sold out
 * ready-made; a size never counted and switched off is made for the order.
 */
export function sizeState(size: StyleSize): "inStock" | "soldOut" | "madeToOrder" {
  if (size.count === 0) return "soldOut";
  return size.inStock ? "inStock" : "madeToOrder";
}

export function primaryPhoto(style: GarmentStyle) {
  return style.photos.find((photo) => photo.isPrimary) ?? style.photos[0];
}

export function sizeLabel(id: SizeId): string {
  return sizes.find((size) => size.id === id)?.label ?? id.toUpperCase();
}

const newYorkDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The calendar day at the atelier, written the way release dates are
 * (YYYY-MM-DD), so the two compare as days and not as instants. Parsing
 * "2026-10-06" gives midnight UTC, which is 8 PM the evening before in the
 * Bronx; compared as instants the season stopped being "next" a night early.
 */
export function shopDay(now: Date): string {
  return newYorkDay.format(now);
}

/**
 * The premiere that is currently open for sign-ups in a given list, if there
 * is one: whichever is still to be released and releases soonest. A season
 * stays next through the whole of its release day. Daysi can have more than
 * one season written down ahead of time, so this is the earliest release
 * date among the ones still upcoming, not merely the first entry of a
 * newest-first list — with two seasons still to come, the one further out
 * is not "next" just because it sits first in that order.
 */
export function upcomingIn(list: readonly Premiere[], today: Date): Premiere | undefined {
  const day = shopDay(today);
  let next: Premiere | undefined;
  for (const premiere of list) {
    if (premiere.releaseDate < day) continue;
    if (!next || premiere.releaseDate < next.releaseDate) next = premiere;
  }
  return next;
}

export function upcomingPremiere(today: Date): Premiere | undefined {
  return upcomingIn(premieres, today);
}

/**
 * What the premiere pages have to show on a given day, from a list that
 * already runs newest first. `next` is the season still to be released that
 * releases soonest, if one is written down; `featured` is that same season
 * whenever there is one, so the cover photograph and the words next to it
 * are never two different seasons — a season written down ahead of "next"
 * (Daysi planning two at once) has the furthest-out release and so must
 * never be the one pictured. Between seasons, with no next one written
 * down yet, `featured` falls back to the newest season either way, the one
 * whose photograph the pages then show; `past` is every season already
 * released, newest first. A season written down ahead of "next" is itself
 * neither next nor past, and so is not shown here — the day after a
 * release there may also be no next season yet, and that gap is Daysi's to
 * fill, not a fault in the code, so both pages read from here and stand on
 * their own.
 *
 * Pulled out of `premiereListing` so `lib/live-premieres.ts` can run the same
 * rule over the seed with Daysi's additions and corrections on top, without
 * this file reaching into the live layer (which itself reads the seed from
 * here) and creating a cycle.
 */
export function premiereListingFrom(
  list: readonly Premiere[],
  today: Date,
): {
  next: Premiere | undefined;
  featured: Premiere | undefined;
  past: readonly Premiere[];
} {
  const day = shopDay(today);
  const next = upcomingIn(list, today);
  return {
    next,
    featured: next ?? list[0],
    past: list.filter((premiere) => premiere.releaseDate < day),
  };
}

export function premiereListing(today: Date): ReturnType<typeof premiereListingFrom> {
  return premiereListingFrom(premieres, today);
}
