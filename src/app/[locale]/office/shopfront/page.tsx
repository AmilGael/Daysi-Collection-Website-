import { getTranslations, setRequestLocale } from "next-intl/server";
import { storedNotice } from "@/lib/live-catalog";
import { NoticeEditor } from "@/components/notice-editor";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { SiteQrCode } from "@/components/site-qr-code";
import { officeViewer } from "../_lib/viewer";
import { applyShopfrontChanges } from "./actions";

/**
 * Shopfront: what the shop says about itself. Today that is the notice at
 * the top of every page and the QR that hangs in the workroom; hours,
 * holidays and the season come here later.
 */
export default async function OfficeShopfrontPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await officeViewer(locale);

  const t = await getTranslations("office");
  const notice = storedNotice();

  return (
    <>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("noticeTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("noticeLead")}
          </p>
        </div>
        <OfficeDraftProvider apply={applyShopfrontChanges}>
          <NoticeEditor
            initialMessage={notice?.message ?? ""}
            initialVisible={notice?.visible ?? false}
          />
        </OfficeDraftProvider>
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
    </>
  );
}
