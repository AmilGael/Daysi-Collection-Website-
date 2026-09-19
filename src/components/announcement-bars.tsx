"use client";

import type { JSX } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { pageForPath, reaches, type AnnouncementReach } from "@/lib/announcement-pages";

export type ShownAnnouncement = {
  readonly id: string;
  /** Already in the page's language. */
  readonly text: string;
  readonly pages: AnnouncementReach;
};

/**
 * The announcements Daysi has switched on, under the site header, on the
 * pages she ticked for each. The layout hands over every live one (a few
 * short lines at most) and this keeps the ones for the page being read, so
 * moving between pages never waits on the server to learn which to show.
 * Several on one page stack, newest last, as she added them.
 */
export function AnnouncementBars({ announcements }: { announcements: readonly ShownAnnouncement[] }): JSX.Element | null {
  const t = useTranslations("common");
  const page = pageForPath(usePathname() ?? "");
  const shown = announcements.filter((announcement) => reaches(announcement.pages, page));
  if (shown.length === 0) return null;

  return (
    <div aria-label={t("announcements")} role="region">
      {shown.map((announcement) => (
        <aside key={announcement.id} className="border-b border-line bg-marigold/15">
          <p className="shell py-3 text-center text-[0.8125rem] leading-relaxed text-ink">{announcement.text}</p>
        </aside>
      ))}
    </div>
  );
}
