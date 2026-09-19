import type { Localized } from "@/content";
import type { AnnouncementReach } from "./announcement-pages";
import { storedNotice } from "./live-catalog";
import { appendRecord, latestBy, readRecords, versionsOf } from "./records";
import { retiredSet } from "./retired";

/**
 * What the shop announces, and where: kept like promotions. Each save is a
 * line, the newest line per id is the announcement, and retiring one is a
 * record of its own, so Restaurar brings it back as it was.
 *
 * Before this, the site had one notice, shown on the home page and the
 * booking page (`site-notice` in live-catalog). Its text is read here as
 * the first announcement, id "site", on those same two pages, until Daysi
 * saves it; from then on the saved line is the announcement and the old
 * record is never read again.
 */
export type Announcement = {
  readonly id: string;
  readonly message: Localized;
  readonly pages: AnnouncementReach;
  readonly visible: boolean;
  readonly updatedAt: string;
};

const ANNOUNCEMENTS = "announcements";
export const LEGACY_ANNOUNCEMENT_ID = "site";

function legacyNotice(): Announcement | null {
  const notice = storedNotice();
  if (!notice || notice.message.trim().length === 0) return null;
  return {
    id: LEGACY_ANNOUNCEMENT_ID,
    message: { es: notice.message, en: notice.message },
    pages: ["home", "appointments"],
    visible: notice.visible,
    updatedAt: notice.updatedAt,
  };
}

export function manageableAnnouncements(): (Announcement & { retired: boolean })[] {
  const retired = retiredSet("announcement");
  const saved = latestBy(readRecords<Announcement>(ANNOUNCEMENTS), (record) => record.id);
  const legacy = saved.some((record) => record.id === LEGACY_ANNOUNCEMENT_ID) ? null : legacyNotice();
  return [...(legacy ? [legacy] : []), ...saved].map((announcement) => ({
    ...announcement,
    retired: retired.has(announcement.id),
  }));
}

/** The ones on the site now: switched on, not retired, with something to say. */
export function liveAnnouncements(): Announcement[] {
  return manageableAnnouncements()
    .filter((announcement) => announcement.visible && !announcement.retired && announcement.message.es.trim().length > 0)
    .map(({ retired: _retired, ...announcement }) => announcement);
}

export function announcementVersions(id: string): Announcement[] {
  return versionsOf<Announcement>(ANNOUNCEMENTS, (record) => record.id, id);
}

export async function saveAnnouncement(announcement: Omit<Announcement, "updatedAt">): Promise<void> {
  await appendRecord(ANNOUNCEMENTS, { ...announcement, updatedAt: new Date().toISOString() });
}
