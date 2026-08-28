import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import { currentViewer } from "@/lib/auth/session";
import { earningsFrom, loadLedger, monthlyReceived } from "@/lib/earnings";
import { listRequests, currentRecords } from "@/lib/request-store";
import { allLiveStyles, storedNotice, styleOverrides } from "@/lib/live-catalog";
import { GALLERY_ORDER, manageableGallery } from "@/lib/live-gallery";
import {
  customFabrics,
  liveAlterations,
  liveAppointmentTypes,
  liveFabrics,
  livePriceList,
} from "@/lib/live-pricing";
import { formatMoney } from "@/lib/money";
import { exportSummary } from "@/lib/books";
import { PageHeader } from "@/components/page-header";
import { OfficeRequestList } from "@/components/office-request-list";
import { CollectionManager, type ManagedStyle } from "@/components/collection-manager";
import { NoticeEditor } from "@/components/notice-editor";
import { PriceManager } from "@/components/price-manager";
import { FabricManager } from "@/components/fabric-manager";
import { BooksExport } from "@/components/books-export";
import { GalleryManager, type ManagedWork } from "@/components/gallery-manager";
import { StyleComposer } from "@/components/style-composer";

/**
 * Daysi's office.
 *
 * Gated twice over: the viewer must be signed in, and their address must be
 * the owner address. A client who guesses the URL gets the same 404 as a page
 * that does not exist — a 403 would confirm there is something here to find.
 */
export default async function OfficePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;

  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  if (viewer.role !== "owner") notFound();

  const t = await getTranslations("office");
  const tg = await getTranslations("gallery");

  const ledger = loadLedger();
  const earnings = earningsFrom(ledger);
  const months = monthlyReceived(ledger, 6, new Date());
  const peak = Math.max(...months.map((month) => month.total), 1);

  const messages = currentRecords(listRequests("contact"));
  const signups = currentRecords(listRequests("premiere-signup"));

  const appointments = ledger.filter((record) => record.kind === "appointment");
  const work = ledger.filter((record) => record.kind !== "appointment");

  const overridesById = new Map(styleOverrides().map((override) => [override.styleId, override]));
  const managedStyles: ManagedStyle[] = allLiveStyles().map((style) => ({
    id: style.id,
    name: translate(style.name, language),
    category: translate(
      categories.find((category) => category.id === style.categoryId)?.name ?? {
        en: style.categoryId,
        es: style.categoryId,
      },
      language,
    ),
    photo: (style.photos.find((photo) => photo.isPrimary) ?? style.photos[0])?.src ?? "",
    photoCount: style.photos.length,
    isPublished: style.isPublished,
    sizes: style.sizes.map((size) => ({
      sizeId: size.sizeId as "s" | "m" | "l",
      inStock: size.inStock,
    })),
    addedPhotos: overridesById.get(style.id)?.addedPhotos ?? [],
    coverSrc: overridesById.get(style.id)?.coverSrc,
  }));
  const notice = storedNotice();

  const composerCategories = categories.map((category) => ({
    id: category.id,
    label: translate(category.name, language),
  }));
  const composerFabrics = liveFabrics().map((fabric) => ({
    id: fabric.id,
    label: translate(fabric.name, language),
  }));
  const pricedPairs = Object.fromEntries(
    livePriceList().map((entry) => [entry.id, entry.fixedPrice]),
  );

  const galleryWorksManaged: ManagedWork[] = manageableGallery().map((work) => ({
    id: work.id,
    src: work.src,
    width: work.width,
    height: work.height,
    category: work.category,
    caption: translate(work.caption, language),
    hidden: work.hidden,
  }));
  const galleryCategories = GALLERY_ORDER.map((id) => ({ id, label: tg(`category.${id}`) }));

  // Ranges an accountant actually asks for, built from today rather than hard
  // coded, so this still offers the right years in 2027.
  const today = new Date();
  const year = today.getFullYear();
  const quarter = Math.floor(today.getMonth() / 3);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const bookPresets = [
    { label: t("booksThisYear"), from: `${year}-01-01`, to: `${year}-12-31` },
    { label: t("booksLastYear"), from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    {
      label: t("booksThisQuarter"),
      from: iso(new Date(year, quarter * 3, 1)),
      to: iso(new Date(year, quarter * 3 + 3, 0)),
    },
  ];
  const booksSummary = exportSummary(ledger, `${year}-01-01`, `${year}-12-31`);

  const priceEntries = livePriceList().map((entry) => ({
    id: entry.id,
    garment: translate(
      categories.find((category) => category.id === entry.categoryId)?.name ?? {
        en: entry.categoryId,
        es: entry.categoryId,
      },
      language,
    ),
    fabric: translate(
      liveFabrics().find((fabric) => fabric.id === entry.fabricId)?.name ?? {
        en: entry.fabricId,
        es: entry.fabricId,
      },
      language,
    ),
    fixedPrice: entry.fixedPrice,
    customizationExtra: entry.customizationExtra,
  }));
  const priceAlterations = liveAlterations().map((alteration) => ({
    id: alteration.id,
    name: translate(alteration.name, language),
    fixedPrice: alteration.fixedPrice,
    rushSurcharge: alteration.rushSurcharge,
  }));
  const priceAppointments = liveAppointmentTypes().map((type) => ({
    id: type.id,
    name: translate(type.name, language),
    fee: type.fee,
  }));

  const customIds = new Set(customFabrics().map((fabric) => fabric.id));
  const fabricWall = liveFabrics().map((fabric) => ({
    id: fabric.id,
    name: translate(fabric.name, language),
    swatchImage: fabric.swatchImage,
    custom: customIds.has(fabric.id),
  }));
  const fabricCategories = (["dresses", "pants", "shirts", "heritage"] as const).map((id) => ({
    id,
    label: translate(
      categories.find((category) => category.id === id)?.name ?? { en: id, es: id },
      language,
    ),
  }));

  return (
    <>
      <PageHeader
        title={t("title", { name: viewer.account.name || "Daysi" })}
        lead={t("lead")}
      />

      <div className="shell flex flex-col gap-16 pb-28">
        <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Figure label={t("received")} value={formatMoney(earnings.received, language)} emphasis />
          <Figure label={t("outstanding")} value={formatMoney(earnings.outstanding, language)} />
          <Figure label={t("openJobs")} value={String(earnings.openCount)} />
          <Figure label={t("upcomingSessions")} value={String(appointments.length)} />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-heading">{t("lastMonths")}</h2>
          {/* A plain bar row: six months is a shape you read, not a chart you study. */}
          <div className="flex items-end gap-3 border-b border-line pb-3" style={{ height: "9rem" }}>
            {months.map((month) => (
              <div key={month.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[0.6875rem] tabular-nums text-ink-faint">
                  {month.total > 0 ? formatMoney(month.total, language) : ""}
                </span>
                <div
                  className="w-full bg-marigold"
                  style={{ height: `${Math.max((month.total / peak) * 100, 1)}%` }}
                  aria-hidden
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            {months.map((month) => (
              <p
                key={month.month}
                className="flex-1 text-center text-[0.625rem] uppercase tracking-[0.14em] text-ink-faint"
              >
                {new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
                  month: "short",
                }).format(new Date(`${month.month}-15T12:00:00`))}
              </p>
            ))}
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("chartNote")}</p>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading">{t("collection")}</h2>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
              {t("collectionLead")}
            </p>
          </div>
          <CollectionManager styles={managedStyles} locale={language} />

          <div className="flex flex-col gap-4 border-t border-line pt-8">
            <div className="flex flex-col gap-2">
              <h3 className="text-[0.9375rem] font-medium">{t("styleAddTitle")}</h3>
              <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
                {t("styleAddLead")}
              </p>
            </div>
            <StyleComposer
              categories={composerCategories}
              fabrics={composerFabrics}
              pricedPairs={pricedPairs}
              locale={language}
            />
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading">{t("galleryTitle")}</h2>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
              {t("galleryLead")}
            </p>
          </div>
          <GalleryManager works={galleryWorksManaged} categories={galleryCategories} />
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading">{t("fabricsTitle")}</h2>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
              {t("fabricsLead")}
            </p>
          </div>
          <FabricManager fabrics={fabricWall} categories={fabricCategories} />
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading">{t("pricesTitle")}</h2>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
              {t("pricesLead")}
            </p>
          </div>
          <PriceManager
            entries={priceEntries}
            alterations={priceAlterations}
            appointments={priceAppointments}
          />
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading">{t("booksTitle")}</h2>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
              {t("booksLead")}
            </p>
          </div>
          <p className="text-[0.875rem] text-ink-soft">
            {t("booksSummary", {
              year: String(year),
              invoices: booksSummary.invoices,
              received: formatMoney(booksSummary.received, language),
              outstanding: formatMoney(booksSummary.outstanding, language),
              tax: formatMoney(booksSummary.salesTax, language),
            })}
          </p>
          <BooksExport
            presets={bookPresets}
            initialFrom={`${year}-01-01`}
            initialTo={`${year}-12-31`}
          />
        </section>

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
          />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-heading">{t("work")}</h2>
          <OfficeRequestList records={work} locale={language} emptyMessage={t("noWork")} />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-heading">{t("sessions")}</h2>
          <OfficeRequestList
            records={appointments}
            locale={language}
            emptyMessage={t("noSessions")}
          />
        </section>

        <section className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-6">
            <h2 className="text-heading">{t("messages")}</h2>
            <OfficeRequestList
              records={messages}
              locale={language}
              emptyMessage={t("noMessages")}
            />
          </div>
          <div className="flex flex-col gap-6">
            <h2 className="text-heading">{t("premiereList")}</h2>
            {signups.length === 0 ? (
              <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
                {t("noSignups")}
              </p>
            ) : (
              <ul className="flex flex-col border-t border-line">
                {signups.map((signup) => (
                  <li
                    key={signup.reference}
                    className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[0.875rem]"
                  >
                    <span className="break-all">{signup.client.email}</span>
                    <span className="shrink-0 text-[0.75rem] text-ink-faint">
                      {String(signup.details.Season ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Figure({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 p-6 ${emphasis ? "bg-ink text-paper" : "bg-paper"}`}>
      <p
        className={`text-[0.625rem] font-medium uppercase tracking-[0.2em] ${
          emphasis ? "text-paper-faint" : "text-ink-faint"
        }`}
      >
        {label}
      </p>
      <p className="font-display text-[1.75rem] tabular-nums leading-none">{value}</p>
    </div>
  );
}
