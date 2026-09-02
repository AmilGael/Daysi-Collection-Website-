"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { OFFICE_TABS } from "./tabs";

/**
 * The row of tabs under the office heading.
 *
 * Each tab is a real link to a real route, so it can be bookmarked and the
 * back button works. Active is an exact match on the pathname, not a prefix:
 * `/office` is the start of every other tab's path, and a prefix test would
 * light Today up everywhere. `usePathname` from the routing helpers hands
 * back the path without its locale, so the comparison is against the hrefs
 * as written in the list.
 *
 * On a phone the strip scrolls sideways rather than wrapping: eight labels
 * on three lines stop reading as tabs. The site header places it: under the
 * bar on narrow screens, where the store links would not fit either.
 */
export function OfficeTabs() {
  const pathname = usePathname();
  const t = useTranslations("office");

  return (
    <nav aria-label={t("tabsLabel")} className="overflow-x-auto">
      <ul className="flex min-w-max">
        {OFFICE_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.75rem] uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                }`}
              >
                {t(tab.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
