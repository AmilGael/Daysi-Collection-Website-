/**
 * The pages of the shop an announcement can be put on, and which of them an
 * address is. Pure, so the bar (a client component that only knows the
 * address) and the office's checkboxes read the same list.
 *
 * "all" means every page here, including any added to this list later. The
 * office, the account, signing in and the checkout pages are not the shop's
 * pages and never carry an announcement.
 */
export const ANNOUNCEMENT_PAGES = [
  { id: "home", segment: "" },
  { id: "collection", segment: "collection" },
  { id: "gallery", segment: "gallery" },
  { id: "premieres", segment: "premieres" },
  { id: "services", segment: "services" },
  { id: "alterations", segment: "alterations" },
  { id: "prices", segment: "prices" },
  { id: "studio", segment: "design-studio" },
  { id: "atelier", segment: "atelier" },
  { id: "appointments", segment: "appointments" },
  { id: "request", segment: "request" },
  { id: "contact", segment: "contact" },
  { id: "cart", segment: "cart" },
] as const;

export type AnnouncementPageId = (typeof ANNOUNCEMENT_PAGES)[number]["id"];
export type AnnouncementReach = "all" | readonly AnnouncementPageId[];

export const ANNOUNCEMENT_PAGE_IDS = ANNOUNCEMENT_PAGES.map((page) => page.id) as [
  AnnouncementPageId,
  ...AnnouncementPageId[],
];

const LOCALES = new Set(["es", "en"]);

/** The page of the shop an address is: the first part after the language. */
export function pageForPath(pathname: string): AnnouncementPageId | null {
  const parts = pathname.split("/").filter(Boolean);
  const rest = parts[0] && LOCALES.has(parts[0]) ? parts.slice(1) : parts;
  const segment = rest[0] ?? "";
  return ANNOUNCEMENT_PAGES.find((page) => page.segment === segment)?.id ?? null;
}

export function reaches(pages: AnnouncementReach, page: AnnouncementPageId | null): boolean {
  if (page === null) return false;
  return pages === "all" || pages.includes(page);
}
