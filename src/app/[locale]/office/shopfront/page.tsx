import { setRequestLocale } from "next-intl/server";
import { categories, shopDay, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { helperEnabled } from "@/lib/env";
import { manageableStyles } from "@/lib/live-catalog";
import { manageableAnnouncements } from "@/lib/announcements";
import { manageablePromotions } from "@/lib/live-promotions";
import { undoableIds } from "@/lib/office-history";
import { helperVisible } from "@/lib/site-helper";
import { ShopfrontCards } from "@/components/shopfront-cards";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { SiteQrCode } from "@/components/site-qr-code";
import { officeViewer } from "../_lib/viewer";
import { applyShopfrontChanges } from "./actions";

/**
 * Shopfront: what the shop says about itself, as four cards. The
 * announcements, each on the pages Daysi picks, the promotions that lower prices by themselves,
 * the visitor helper's own switch, and the QR that hangs in the workroom;
 * hours, holidays and the season come here later.
 */
export default async function OfficeShopfrontPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const announcements = manageableAnnouncements();
  const undoableAnnouncements = undoableIds("announcement");
  const undoablePromotions = undoableIds("promotion");
  const promotions = manageablePromotions();

  return (
    <OfficeDraftProvider apply={applyShopfrontChanges}>
      <section className="flex flex-col gap-6">
        <ShopfrontCards
          announcements={announcements
            .filter((announcement) => !announcement.retired)
            .map(({ retired: _retired, ...announcement }) => ({
              ...announcement,
              undoable: undoableAnnouncements.has(announcement.id),
            }))}
          retiredAnnouncements={announcements
            .filter((announcement) => announcement.retired)
            .map(({ retired: _retired, ...announcement }) => announcement)}
          promotions={promotions
            .filter((promotion) => !promotion.retired)
            .map(({ retired: _retired, ...promotion }) => ({
              ...promotion,
              undoable: undoablePromotions.has(promotion.id),
            }))}
          retiredPromotions={promotions
            .filter((promotion) => promotion.retired)
            .map(({ retired: _retired, ...promotion }) => promotion)}
          categories={categories.map((category) => ({ id: category.id, name: translate(category.name, language) }))}
          styles={manageableStyles().map((style) => ({
            id: style.id,
            name: translate(style.name, language),
            retired: style.retired,
          }))}
          today={shopDay(new Date())}
          helperInitialVisible={helperVisible()}
          helperUndoable={undoableIds("helper").has("site")}
          helperDisabled={!helperEnabled}
          qrThumbnail={<SiteQrCode size={72} />}
          qrFull={<SiteQrCode size={220} />}
        />
      </section>
    </OfficeDraftProvider>
  );
}
