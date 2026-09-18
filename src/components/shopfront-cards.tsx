"use client";

import { useCallback, useState, type JSX, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate, type Promotion } from "@/content";
import type { Locale } from "@/i18n/routing";
import type { ShopfrontChange } from "@/lib/office-validation";
import { HelperSwitch } from "./helper-switch";
import { NoticeEditor } from "./notice-editor";
import { Pending } from "./office/confirm-bar";
import {
  formatDay,
  NOTICE_KEY,
  promotionKeyFor,
  soonestEnding,
  type ManagedPromotion,
  type ScopeOption,
} from "./office/shopfront-draft";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";
import { PromotionEditor } from "./promotion-editor";
import { Tag } from "./ui";

type Notice = { readonly message: string; readonly visible: boolean };
type OpenSheet = "notice" | "promotions" | "qr" | null;

const card =
  "flex h-full w-full flex-col gap-3 border border-line p-5 text-left transition-colors hover:border-ink";

/**
 * Vitrina as four cards: what the site says of itself (Aviso), what lowers
 * a price by itself (Promociones), the "¿Preguntas?" panel's own switch
 * (Asistente para clientes, right on its card — Task 17's switch never
 * needed a sheet, there is nothing else to it), and the workroom's QR.
 * Tapping the first, second or fourth opens a sheet; the third's Switch
 * acts where it sits.
 */
export function ShopfrontCards({
  notice,
  noticeUndoable,
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
  notice: Notice;
  noticeUndoable: boolean;
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

  const noticePending = draft.pending(NOTICE_KEY);
  const noticeWire = noticePending?.change.wire;
  const noticeMessage = noticeWire?.type === "notice" ? noticeWire.message : notice.message;
  const noticeVisible = noticeWire?.type === "notice" ? noticeWire.visible : notice.visible;

  // A promotion's own `active` field, unless a switch on it is staged but
  // not yet confirmed; one pending a retire never counts, whichever way its
  // own switch last sat.
  const activePromotions = promotions.flatMap((promotion) => {
    const wire = draft.pending(promotionKeyFor(promotion.id))?.change.wire;
    if (wire?.type === "retire") return [];
    const active = wire?.type === "promotion" ? wire.active : promotion.active;
    return active ? [promotion] : [];
  });
  const soonest = soonestEnding(activePromotions, today);

  const title =
    open === "notice" ? t("noticeTitle") : open === "promotions" ? t("promoTitle") : open === "qr" ? t("qrTitle") : "";

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <button type="button" onClick={() => setOpen("notice")} className={card}>
            <span className="font-display text-[1.0625rem] leading-tight">{t("noticeTitle")}</span>
            <span className="line-clamp-2 flex-1 text-[0.8125rem] leading-relaxed text-ink-soft">
              {noticeMessage || t("noticeEmpty")}
            </span>
            <Tag tone={noticeVisible ? "marigold" : "quiet"}>
              {noticeVisible ? t("noticeOnChip") : t("noticeOffChip")}
            </Tag>
          </button>
          {noticePending ? (
            <div className="mt-2">
              <Pending confirming={noticePending.confirming} error={noticePending.error} count={noticePending.count} />
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

      <a
        href="/api/office/manual"
        target="_blank"
        rel="noopener"
        className="w-fit text-[0.8125rem] underline underline-offset-4"
      >
        {t("helpOpenManual")}
      </a>

      <Sheet open={open !== null} title={title} onClose={close}>
        {open === "notice" ? (
          <NoticeEditor initialMessage={notice.message} initialVisible={notice.visible} undoable={noticeUndoable} />
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
