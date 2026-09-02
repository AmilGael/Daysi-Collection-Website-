import type { GarmentStyle, PriceListEntry } from "@/content/types";
import { manageableStyles } from "./live-catalog";
import { manageablePriceList } from "./live-pricing";

/** Pure: how many of these styles price themselves through this entry. */
export function stylesUsingEntry(
  styles: readonly GarmentStyle[],
  entryId: string,
): number {
  return styles.filter((style) => style.priceEntryId === entryId).length;
}

/**
 * Pure: how many price themselves through any entry of this fabric. Falls
 * back to the `${category}--${fabric}` id shape when an entry is not listed.
 */
export function stylesUsingFabric(
  styles: readonly GarmentStyle[],
  entries: readonly PriceListEntry[],
  fabricId: string,
): number {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return styles.filter((style) => {
    const entry = byId.get(style.priceEntryId);
    return entry
      ? entry.fabricId === fabricId
      : style.priceEntryId.endsWith(`--${fabricId}`);
  }).length;
}

/** Live, active styles only. */
export function liveStylesUsingEntry(entryId: string): number {
  const styles = manageableStyles().filter((style) => !style.retired);
  return stylesUsingEntry(styles, entryId);
}

/** Live, active styles only. */
export function liveStylesUsingFabric(fabricId: string): number {
  const styles = manageableStyles().filter((style) => !style.retired);
  return stylesUsingFabric(styles, manageablePriceList(), fabricId);
}
