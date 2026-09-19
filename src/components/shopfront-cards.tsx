"use client";

import { useCallback, useState, type JSX, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate, type Promotion } from "@/content";
import { Link, type Locale } from "@/i18n/routing";
import type { ShopfrontChange } from "@/lib/office-validation";
import { promotionActiveToday } from "@/lib/promotions";
import { HelperSwitch } from "./helper-switch";
import { AnnouncementEditor } from "./announcement-editor";
import { Pending } from "./office/confirm-bar";
import {
  announcementKeyFor,
  formatDay,
  promotionKeyFor,
  soonestEnding,
  type ManagedAnnouncement,
  type ManagedPromotion,
  type ScopeOption,
} from "./office/shopfront-draft";
import type { Announcement } from "@/lib/announcements";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";
import { PromotionEditor } from "./promotion-editor";
import { Tag } from "./ui";

type OpenSheet = "announcements" | "promotions" | "qr" | null;

const card =
  "flex h-full w-full flex-col gap-3 border border-line p-5 text-left transition-colors hover:border-ink";

/**
 * Vitrina as four cards: what the site announces, and on which pages
 * (Anuncios), what lowers
 * a price by itself (Promociones), the "¿Preguntas?" panel's own switch
 * (Asistente para clientes, right on its card — Task 17's switch never
 * needed a sheet, there is nothing else to it), and the workroom's QR.
 * Tapping the first, second or fourth opens a sheet; the third's Switch
 * acts where it sits.
 */
export function ShopfrontCards({
  announcements,
  retiredAnnouncements,
  promotions,
  retiredPromotions,
  categories,
  styles,
  today,
  helperInitialVisible,
  helperUndoable,
  helperDisabled,
  qrThumbnail,
  qrFull,
}: {
  announcements: readonly ManagedAnnouncement[];
  retiredAnnouncements: readonly Announcement[];
  promotions: readonly ManagedPromotion[];
  retiredPromotions: readonly Promotion[];
  categories: readonly ScopeOption[];
  styles: readonly ScopeOption[];
  /** The atelier's day on the server, so the page and the browser agree on what is running. */
  today: string;
  helperInitialVisible: boolean;
  helperUndoable: boolean;
  helperDisabled: boolean;
  /** A small QR, rendered on the server so it draws sharp at any size. */
  qrThumbnail: ReactNode;
  /** The same QR, large, for the sheet. */
  qrFull: ReactNode;
}): JSX.Element {
  const t = useTranslations("office");
  const locale = useLocale() as Locale;
  const draft = useOfficeDraft<ShopfrontChange>();
  const [open, setOpen] = useState<OpenSheet>(null);
  const close = useCallback(() => setOpen(null), []);

  // What is on the site once she confirms: each announcement's own switch
  // unless an edit or a retire on it is staged, and any new one switched on.
  const announcementEntries = draft.entries.filter((entry) => entry.key.startsWith("announcement:"));
  const announcementsShowing = [
    ...announcements.flatMap((announcement) => {
      const wire = draft.pending(announcementKeyFor(announcement.id))?.change.wire;
      if (wire?.type === "retire") return [];
      const visible = wire?.type === "announcement" ? wire.visible : announcement.visible;
      return visible ? [wire?.type === "announcement" ? wire.message : translate(announcement.message, locale)] : [];
    }),
    ...announcementEntries.flatMap((entry) =>
      entry.change.wire.type === "announcement" && entry.change.wire.id === undefined && entry.change.wire.visible
        ? [entry.change.wire.message]
        : [],
    ),
  ];
  const announcementPending = announcementEntries[0] ? draft.pending(announcementEntries[0].key) : undefined;

  // A promotion's own `active` field and dates, unless an edit on it is
  // staged but not yet confirmed; one pending a retire never counts,
  // whichever way its own switch last sat. Only one running today — active
  // and within its NY-day dates, `promotionApplies`'s own date check — is
  // counted, so one not yet started or already over never inflates the tally.
  const activePromotions = promotions.flatMap((promotion) => {
    const wire = draft.pending(promotionKeyFor(promotion.id))?.change.wire;
    if (wire?.type === "retire") return [];
    const active = wire?.type === "promotion" ? wire.active : promotion.active;
    const startsAt = wire?.type === "promotion" ? wire.startsAt : promotion.startsAt;
    const endsAt = wire?.type === "promotion" ? wire.endsAt : promotion.endsAt;
    return promotionActiveToday({ active, startsAt, endsAt }, today) ? [promotion] : [];
  });
  const soonest = soonestEnding(activePromotions, today);

  const title =
    open === "announcements" ? t("annTitle") : open === "promotions" ? t("promoTitle") : open === "qr" ? t("qrTitle") : "";

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <button type="button" onClick={() => setOpen("announcements")} className={card}>
            <span className="font-display text-[1.0625rem] leading-tight">{t("annTitle")}</span>
            <span className="line-clamp-2 flex-1 text-[0.8125rem] leading-relaxed text-ink-soft">
              {announcementsShowing[0] ?? (announcements.length === 0 ? t("annEmpty") : t("annNoneShowing"))}
            </span>
            <Tag tone={announcementsShowing.length > 0 ? "marigold" : "quiet"}>
              {t("annShowingCount", { count: announcementsShowing.length })}
            </Tag>
          </button>
          {announcementPending ? (
            <div className="mt-2">
              <Pending
                confirming={announcementPending.confirming}
                error={announcementPending.error}
                count={announcementPending.count}
              />
            </div>
          ) : null}
        </li>

        <li>
          <button type="button" onClick={() => setOpen("promotions")} className={card}>
            <span className="font-display text-[1.0625rem] leading-tight">{t("promoTitle")}</span>
            {promotions.length === 0 ? (
              <span className="flex-1 text-[0.8125rem] leading-relaxed text-ink-soft">{t("promoEmpty")}</span>
            ) : (
              <span className="flex flex-1 flex-col gap-1 text-[0.8125rem] leading-relaxed">
                <span className="text-ink-soft">{t("promoActiveCount", { count: activePromotions.length })}</span>
                {soonest ? (
                  <span className="text-ink-faint">
                    {translate(soonest.label, locale)} · {t("promoDatesTo", { to: formatDay(soonest.endsAt, locale) })}
                  </span>
                ) : null}
              </span>
            )}
          </button>
        </li>

        <li>
          <div className="flex h-full flex-col gap-3 border border-line p-5">
            <span className="line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-soft">{t("helperLead")}</span>
            <HelperSwitch initialVisible={helperInitialVisible} undoable={helperUndoable} disabled={helperDisabled} />
          </div>
        </li>

        <li>
          <button type="button" onClick={() => setOpen("qr")} className={`${card} items-center text-center`}>
            {qrThumbnail}
            <span className="font-display text-[1.0625rem] leading-tight">{t("qrTitle")}</span>
          </button>
        </li>
      </ul>

      <Link href="/office/manual" className="w-fit text-[0.8125rem] underline underline-offset-4">
        {t("helpOpenManual")}
      </Link>

      <Sheet open={open !== null} title={title} onClose={close}>
        {open === "announcements" ? (
          <AnnouncementEditor announcements={announcements} retired={retiredAnnouncements} />
        ) : open === "promotions" ? (
          <PromotionEditor
            promotions={promotions}
            retired={retiredPromotions}
            categories={categories}
            styles={styles}
            today={today}
          />
        ) : open === "qr" ? (
          <div className="flex flex-col items-center gap-6">
            <p className="max-w-xs text-center text-[0.875rem] leading-relaxed text-ink-faint">{t("qrLead")}</p>
            {qrFull}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
