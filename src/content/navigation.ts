/**
 * Where the header can take you.
 *
 * There used to be two lists here: six destinations for the bar and eight for
 * the menu, written out separately and free to disagree with each other. This
 * is one list, and the bar is a view of it — `inBar` is the only thing that
 * decides whether a destination is printed across the top or waits behind the
 * menu button.
 *
 * The bar is width-bound and the binding constraint is Spanish, which runs
 * about a fifth longer than English. Measured at the sizes the header actually
 * uses: the logo takes 142px, the seven bar tabs 661px, and the controls on
 * the right 315px once they stopped being four bordered boxes. With the shell's
 * gutters that lands at 1258px, so the bar appears at 1200px, where the booking
 * button drops to its short label and buys back the difference.
 *
 * Adding an eighth tab is not free: it costs about 90px in Spanish and pushes
 * the bar past 1350px, which is why Services stays in the menu. That is also
 * what keeps the menu button honest — it reaches somewhere the bar cannot,
 * rather than restating what is already printed beside it.
 */
export type NavTab = {
  readonly href: string;
  /** A key under `nav` in the message bundles. */
  readonly label: string;
  readonly inBar: boolean;
};

export const NAV_TABS: readonly NavTab[] = [
  { href: "/collection", label: "collection", inBar: true },
  { href: "/gallery", label: "gallery", inBar: true },
  { href: "/premieres", label: "premieres", inBar: true },
  { href: "/services", label: "services", inBar: false },
  { href: "/alterations", label: "alterations", inBar: true },
  { href: "/prices", label: "prices", inBar: true },
  { href: "/design-studio", label: "studio", inBar: true },
  { href: "/atelier", label: "atelier", inBar: true },
];

/** The destinations printed across the bar, in the order the menu lists them. */
export const BAR_TABS: readonly NavTab[] = NAV_TABS.filter((tab) => tab.inBar);
