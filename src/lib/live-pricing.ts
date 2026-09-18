import {
  alterationServices,
  appointmentTypes,
  fabrics,
  priceList,
  shopDay,
  type AlterationService,
  type AppointmentType,
  type Fabric,
  type GarmentStyle,
  type PriceListEntry,
  type PricedStyle,
  type Promotion,
  type StylePrice,
} from "@/content";
import { livePromotions } from "./live-promotions";
import { pickPromotion } from "./promotions";
import { appendRecord, latestBy, readRecords } from "./records";
import { retiredSet } from "./retired";

/**
 * The live layer over the published prices — the same idea as lib/live-catalog:
 * `content/price-list.ts` stays the price list as coded, and what Daysi changes
 * from the office lands here as append-only override records. Every reader on
 * the server merges the newest override per id, so the promise the site makes
 * — one price list, no negotiation — keeps holding with her numbers in it.
 *
 * Custom fabrics ride the same layer: a fabric Daysi adds from the office
 * carries its own per-category prices, which surface as generated price list
 * entries beside the coded ones. So do the alterations and sessions she adds:
 * each is listed after the coded ones, takes her later price edits like any
 * other, and leaves every public list when she retires it. The coded ones
 * cannot be retired, only repriced.
 */

export type PriceEntryOverride = {
  readonly entryId: string;
  readonly fixedPrice: number;
  readonly customizationExtra: number;
  readonly updatedAt: string;
};

export type AlterationOverride = {
  readonly alterationId: string;
  readonly fixedPrice: number;
  readonly rushSurcharge: number;
  readonly updatedAt: string;
};

export type AppointmentOverride = {
  readonly typeId: string;
  readonly fee: number;
  readonly updatedAt: string;
};

export type CustomFabric = {
  readonly id: string;
  readonly name: string;
  readonly swatchImage: string;
  readonly averageColor: string;
  /** Cents per category this fabric is offered in. Missing = not offered. */
  readonly prices: Readonly<
    Partial<Record<"dresses" | "pants" | "shirts" | "heritage", number>>
  >;
  readonly updatedAt: string;
};

/** An alteration Daysi added from the office, as it was typed and translated. */
export type AddedAlteration = AlterationService & { readonly addedAt: string };
/** A session Daysi added from the office. */
export type AddedAppointmentType = AppointmentType & { readonly addedAt: string };

export type { PricedStyle, StylePrice } from "@/content";

const ENTRY_OVERRIDES = "price-overrides";
const ALTERATION_OVERRIDES = "alteration-overrides";
const APPOINTMENT_OVERRIDES = "appointment-overrides";
const CUSTOM_FABRICS = "custom-fabrics";
const CUSTOM_ENTRIES = "price-entries";
const ADDED_ALTERATIONS = "added-alterations";
const ADDED_APPOINTMENT_TYPES = "added-appointment-types";

/** The coded per-category customization charges, reused for custom fabrics. */
export const CUSTOMIZATION_EXTRA: Record<string, number> = {
  dresses: 9500,
  pants: 6500,
  shirts: 5500,
  heritage: 12000,
};

/* ------------------------------------------------------------------ pure -- */

export function applyEntryOverrides(
  entries: readonly PriceListEntry[],
  overrides: readonly PriceEntryOverride[],
): PriceListEntry[] {
  const byId = new Map(overrides.map((override) => [override.entryId, override]));
  return entries.map((entry) => {
    const override = byId.get(entry.id);
    if (!override) return entry;
    return {
      ...entry,
      fixedPrice: override.fixedPrice,
      customizationExtra: override.customizationExtra,
    };
  });
}

export function applyAlterationOverrides(
  alterations: readonly AlterationService[],
  overrides: readonly AlterationOverride[],
): AlterationService[] {
  const byId = new Map(overrides.map((override) => [override.alterationId, override]));
  return alterations.map((alteration) => {
    const override = byId.get(alteration.id);
    if (!override) return alteration;
    return {
      ...alteration,
      fixedPrice: override.fixedPrice,
      rushSurcharge: override.rushSurcharge,
    };
  });
}

export function applyAppointmentOverrides(
  types: readonly AppointmentType[],
  overrides: readonly AppointmentOverride[],
): AppointmentType[] {
  const byId = new Map(overrides.map((override) => [override.typeId, override]));
  return types.map((type) => {
    const override = byId.get(type.id);
    if (!override) return type;
    // The whole fee holds the slot, so the deposit follows the fee.
    return { ...type, fee: override.fee, depositDue: override.fee };
  });
}

/**
 * One published list of services: the coded ones, then the ones Daysi added,
 * with her price edits applied over the lot and her retirements taken out.
 */
export function assembleServices<T extends { readonly id: string }>(
  coded: readonly T[],
  added: readonly T[],
  applyOverrides: (all: readonly T[]) => T[],
  retired: ReadonlySet<string> = new Set(),
): T[] {
  return applyOverrides([...coded, ...added]).filter((service) => !retired.has(service.id));
}

export function fabricFromCustom(custom: CustomFabric): Fabric {
  return {
    id: custom.id,
    name: { en: custom.name, es: custom.name },
    description: {
      en: "Brought into the atelier by Daysi. Ask to see it in person.",
      es: "Traída al taller por Daysi. Pida verla en persona.",
    },
    swatchImage: custom.swatchImage,
    averageColor: custom.averageColor,
  };
}

export function entriesFromCustom(custom: CustomFabric): PriceListEntry[] {
  return Object.entries(custom.prices).map(([categoryId, fixedPrice]) => ({
    id: `${categoryId}--${custom.id}`,
    categoryId,
    fabricId: custom.id,
    fixedPrice,
    customizationExtra: CUSTOMIZATION_EXTRA[categoryId] ?? 9500,
    customizationNote: {
      en: "Made to your measurements, with your choice of neckline, sleeve and length.",
      es: "Hecho a su medida, con el escote, la manga y el largo que usted elija.",
    },
    effectiveDate: custom.updatedAt.slice(0, 10),
  }));
}

/**
 * The whole published list: what the site ships with, what her fabrics imply,
 * and any entry she has written herself — with her edits applied over the lot.
 */
export function assemblePriceList(
  coded: readonly PriceListEntry[],
  fromFabrics: readonly PriceListEntry[],
  custom: readonly PriceListEntry[],
  overrides: readonly PriceEntryOverride[],
  retired: ReadonlySet<string> = new Set(),
): PriceListEntry[] {
  // One row per garment-and-cloth pair. Where the same pair is priced twice,
  // the later source wins: a price Daysi wrote is a decision she made after
  // the one that shipped.
  const byId = new Map<string, PriceListEntry>();
  for (const entry of [...coded, ...fromFabrics, ...custom]) byId.set(entry.id, entry);
  return applyEntryOverrides([...byId.values()], overrides).filter(
    (entry) => !retired.has(entry.id),
  );
}

/**
 * What one garment costs: its pair's entry, with the garment's own numbers in
 * place of the entry's when Daysi set them. The entry has to be live either
 * way, so a retired or never-priced pair leaves the garment unpriced (and off
 * sale) whatever it carries, exactly as before own prices existed.
 *
 * The promotion that reaches the garment on `day` rides along, own price or
 * list price alike; the numbers stay undiscounted, because only the garment
 * line is lowered (`lib/pricing.ts`), never the made-to-measure extra. Pure
 * once `promotions` is given; left out, it reads the live list.
 */
export function resolveStylePrice(
  style: Pick<GarmentStyle, "id" | "categoryId" | "priceEntryId" | "ownPrice">,
  entries: readonly PriceListEntry[],
  promotions: readonly Promotion[] = livePromotions(),
  day: string = shopDay(new Date()),
): StylePrice | null {
  const entry = entries.find((candidate) => candidate.id === style.priceEntryId);
  if (!entry) return null;
  const own = style.ownPrice;
  const promotion = pickPromotion(promotions, style, day);
  return {
    entryId: entry.id,
    fabricId: entry.fabricId,
    fixedPrice: own?.fixedPrice ?? entry.fixedPrice,
    customizationExtra: own?.customizationExtra ?? entry.customizationExtra,
    customizationNote: entry.customizationNote,
    own: own !== undefined,
    ...(promotion ? { promotion } : {}),
  };
}

/* ------------------------------------------------------------------ live -- */

export function manageableCustomFabrics(): (CustomFabric & { retired: boolean })[] {
  const retired = retiredSet("fabric");
  return latestBy(readRecords<CustomFabric>(CUSTOM_FABRICS), (record) => record.id).map(
    (fabric) => ({ ...fabric, retired: retired.has(fabric.id) }),
  );
}

export function customFabrics(): CustomFabric[] {
  return manageableCustomFabrics()
    .filter((fabric) => !fabric.retired)
    .map(({ retired: _retired, ...fabric }) => fabric);
}

export function liveFabrics(): Fabric[] {
  return [...fabrics, ...customFabrics().map(fabricFromCustom)];
}

/** Price rows Daysi wrote herself, usually when adding a garment. */
export function customEntries(): PriceListEntry[] {
  return latestBy(readRecords<PriceListEntry>(CUSTOM_ENTRIES), (entry) => entry.id);
}

export function livePriceList(): PriceListEntry[] {
  return assemblePriceList(
    priceList,
    customFabrics().flatMap(entriesFromCustom),
    customEntries(),
    latestBy(readRecords<PriceEntryOverride>(ENTRY_OVERRIDES), (record) => record.entryId),
    retiredSet("price-entry"),
  );
}

export function manageablePriceList(): (PriceListEntry & { retired: boolean })[] {
  const retired = retiredSet("price-entry");
  return assemblePriceList(
    priceList,
    customFabrics().flatMap(entriesFromCustom),
    customEntries(),
    latestBy(readRecords<PriceEntryOverride>(ENTRY_OVERRIDES), (record) => record.entryId),
  ).map((entry) => ({ ...entry, retired: retired.has(entry.id) }));
}

export async function saveCustomEntry(entry: PriceListEntry): Promise<void> {
  await appendRecord(CUSTOM_ENTRIES, entry);
}

export function addedAlterations(): AddedAlteration[] {
  return latestBy(readRecords<AddedAlteration>(ADDED_ALTERATIONS), (record) => record.id);
}

export function addedAppointmentTypes(): AddedAppointmentType[] {
  return latestBy(readRecords<AddedAppointmentType>(ADDED_APPOINTMENT_TYPES), (record) => record.id);
}

function alterationOverrides(): AlterationOverride[] {
  return latestBy(readRecords<AlterationOverride>(ALTERATION_OVERRIDES), (record) => record.alterationId);
}

function appointmentOverrides(): AppointmentOverride[] {
  return latestBy(readRecords<AppointmentOverride>(APPOINTMENT_OVERRIDES), (record) => record.typeId);
}

export function liveAlterations(): AlterationService[] {
  return assembleServices<AlterationService>(
    alterationServices,
    addedAlterations(),
    (all) => applyAlterationOverrides(all, alterationOverrides()),
    retiredSet("alteration"),
  );
}

export function liveAppointmentTypes(): AppointmentType[] {
  return assembleServices<AppointmentType>(
    appointmentTypes,
    addedAppointmentTypes(),
    (all) => applyAppointmentOverrides(all, appointmentOverrides()),
    retiredSet("appointment-type"),
  );
}

/** Every alteration the office can price, retired ones marked, coded ones marked as such. */
export function manageableAlterations(): (AlterationService & { retired: boolean; coded: boolean })[] {
  const retired = retiredSet("alteration");
  const coded = new Set(alterationServices.map((alteration) => alteration.id));
  return assembleServices<AlterationService>(alterationServices, addedAlterations(), (all) =>
    applyAlterationOverrides(all, alterationOverrides()),
  ).map((alteration) => ({ ...alteration, retired: retired.has(alteration.id), coded: coded.has(alteration.id) }));
}

/** Every session the office can price, retired ones marked, coded ones marked as such. */
export function manageableAppointmentTypes(): (AppointmentType & { retired: boolean; coded: boolean })[] {
  const retired = retiredSet("appointment-type");
  const coded = new Set(appointmentTypes.map((type) => type.id));
  return assembleServices<AppointmentType>(appointmentTypes, addedAppointmentTypes(), (all) =>
    applyAppointmentOverrides(all, appointmentOverrides()),
  ).map((type) => ({ ...type, retired: retired.has(type.id), coded: coded.has(type.id) }));
}

export function liveFindPriceEntry(id: string): PriceListEntry | undefined {
  return livePriceList().find((entry) => entry.id === id);
}

/** The one way a garment is priced, on every card, page, estimate and cart. */
export function priceFor(
  style: GarmentStyle,
  promotions: readonly Promotion[] = livePromotions(),
  day: string = shopDay(new Date()),
): StylePrice | null {
  return resolveStylePrice(style, livePriceList(), promotions, day);
}

/** Garments with their prices worked out, for cards rendered inside client components. */
export function withPrices(
  styles: readonly GarmentStyle[],
  promotions: readonly Promotion[] = livePromotions(),
  day: string = shopDay(new Date()),
): PricedStyle[] {
  const entries = livePriceList();
  return styles.map((style) => ({ ...style, price: resolveStylePrice(style, entries, promotions, day) }));
}

export function liveFindFabric(id: string): Fabric | undefined {
  return liveFabrics().find((fabric) => fabric.id === id);
}

export function liveFindAlteration(id: string): AlterationService | undefined {
  return liveAlterations().find((alteration) => alteration.id === id);
}

export function liveFindAppointmentType(id: string): AppointmentType | undefined {
  return liveAppointmentTypes().find((type) => type.id === id);
}

/* ---------------------------------------------------------------- writes -- */

export async function saveEntryOverride(
  override: Omit<PriceEntryOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(ENTRY_OVERRIDES, { ...override, updatedAt: new Date().toISOString() });
}

export async function saveAlterationOverride(
  override: Omit<AlterationOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(ALTERATION_OVERRIDES, {
    ...override,
    updatedAt: new Date().toISOString(),
  });
}

export async function saveAppointmentOverride(
  override: Omit<AppointmentOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(APPOINTMENT_OVERRIDES, {
    ...override,
    updatedAt: new Date().toISOString(),
  });
}

export async function saveCustomFabric(
  fabric: Omit<CustomFabric, "updatedAt">,
): Promise<void> {
  await appendRecord(CUSTOM_FABRICS, { ...fabric, updatedAt: new Date().toISOString() });
}

export async function saveAddedAlteration(alteration: AlterationService): Promise<void> {
  await appendRecord(ADDED_ALTERATIONS, { ...alteration, addedAt: new Date().toISOString() });
}

export async function saveAddedAppointmentType(type: AppointmentType): Promise<void> {
  await appendRecord(ADDED_APPOINTMENT_TYPES, { ...type, addedAt: new Date().toISOString() });
}
