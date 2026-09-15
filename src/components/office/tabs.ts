/**
 * The office, as a row of tabs.
 *
 * One list, read by the layout (to draw the strip), by the tests (to check
 * every tab has a page, a guard, a smoke check and a name in each language)
 * and by nothing else. The order is the order Daysi works in: the hub
 * first, then what she sells, then the shop's own settings.
 */
export const OFFICE_TABS = [
  { id: "hub", href: "/office", labelKey: "tabHub" },
  { id: "collection", href: "/office/collection", labelKey: "tabCollection" },
  { id: "gallery", href: "/office/gallery", labelKey: "tabGallery" },
  { id: "fabrics", href: "/office/fabrics", labelKey: "tabFabrics" },
  { id: "prices", href: "/office/prices", labelKey: "tabPrices" },
  { id: "shopfront", href: "/office/shopfront", labelKey: "tabShopfront" },
  { id: "books", href: "/office/books", labelKey: "tabBooks" },
] as const;

export type OfficeTab = (typeof OFFICE_TABS)[number];
export type OfficeTabId = OfficeTab["id"];
