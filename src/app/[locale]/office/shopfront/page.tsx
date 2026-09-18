import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories, shopDay, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { helperEnabled } from "@/lib/env";
import { manageableStyles, storedNotice } from "@/lib/live-catalog";
import { manageablePromotions } from "@/lib/live-promotions";
import { undoableIds } from "@/lib/office-history";
import { helperVisible } from "@/lib/site-helper";
import { HelperSwitch } from "@/components/helper-switch";
import { NoticeEditor } from "@/components/notice-editor";
import { PromotionEditor } from "@/components/promotion-editor";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { SiteQrCode } from "@/components/site-qr-code";
import { officeViewer } from "../_lib/viewer";
import { applyShopfrontChanges } from "./actions";

/**
 * Shopfront: what the shop says about itself. The notice at the top of every
 * page, the promotions that lower prices by themselves, and the QR that
 * hangs in the workroom; hours, holidays and the season come here later.
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

  const t = await getTranslations("office");
  const notice = storedNotice();
  const undoable = undoableIds("notice").has("site");

  const undoablePromotions = undoableIds("promotion");
  const promotions = manageablePromotions();

  return (
    <OfficeDraftProvider apply={applyShopfrontChanges}>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("noticeTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("noticeLead")}
          </p>
        </div>
        <NoticeEditor
          initialMessage={notice?.message ?? ""}
          initialVisible={notice?.visible ?? false}
          undoable={undoable}
        />
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("promoTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("promoLead")}
          </p>
        </div>
        <PromotionEditor
          promotions={promotions
            .filter((promotion) => !promotion.retired)
            .map(({ retired: _retired, ...promotion }) => ({
              ...promotion,
              undoable: undoablePromotions.has(promotion.id),
            }))}
          retired={promotions
            .filter((promotion) => promotion.retired)
            .map(({ retired: _retired, ...promotion }) => promotion)}
          categories={categories.map((category) => ({ id: category.id, name: translate(category.name, language) }))}
          styles={manageableStyles().map((style) => ({
            id: style.id,
            name: translate(style.name, language),
            retired: style.retired,
          }))}
          today={shopDay(new Date())}
        />
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("helperTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("helperLead")}
          </p>
        </div>
        <HelperSwitch
          initialVisible={helperVisible()}
          undoable={undoableIds("helper").has("site")}
          disabled={!helperEnabled}
        />
      </section>

      {/* The workroom QR, moved off the public contact page: it is Daysi's
          to print and hang, not a visitor's. It draws as a real SVG, so it
          prints sharp at any size straight from this page. */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("qrTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("qrLead")}
          </p>
        </div>
        <SiteQrCode size={192} />
      </section>
    </OfficeDraftProvider>
  );
}
