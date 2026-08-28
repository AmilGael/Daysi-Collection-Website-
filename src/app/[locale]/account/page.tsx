import { getTranslations, setRequestLocale } from "next-intl/server";
import { business, translate } from "@/content";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { currentViewer } from "@/lib/auth/session";
import { requestsForAccount } from "@/lib/request-store";
import { whatsappLink } from "@/lib/whatsapp";
import { PageHeader } from "@/components/page-header";
import { RequestList } from "@/components/request-list";
import { ButtonLink, ExternalButtonLink, TextLink } from "@/components/ui";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;

  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);

  const t = await getTranslations("account");

  // Everything of theirs, newest first; the page shows the most recent few and
  // links to the full history.
  const records = requestsForAccount(viewer.account, [
    "order",
    "alteration",
    "commission",
    "appointment",
  ]);
  const recent = records.slice(0, 5);

  return (
    <>
      <PageHeader
        title={viewer.account.name || t("yourAccount")}
        lead={t("accountLead")}
      />

      <div className="shell grid gap-14 pb-28 lg:grid-cols-[1fr_20rem] lg:gap-20">
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-heading">{t("recentActivity")}</h2>
            {records.length > recent.length ? (
              <TextLink href="/account/orders">{t("seeAll")}</TextLink>
            ) : null}
          </div>
          <RequestList
            records={recent}
            locale={language}
            emptyMessage={t("nothingYet")}
          />
          {records.length === 0 ? (
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/collection" size="small">
                {t("browseCollection")}
              </ButtonLink>
              <ButtonLink href="/request" size="small" tone="outline">
                {t("makeRequest")}
              </ButtonLink>
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-8 lg:border-l lg:border-line lg:pl-10">
          <div className="flex flex-col gap-3">
            <h2 className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-ink-faint">
              {t("yourDetails")}
            </h2>
            <dl className="flex flex-col gap-2 text-[0.875rem]">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-faint">{t("name")}</dt>
                <dd>{viewer.account.name || "–"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-faint">{t("email")}</dt>
                <dd className="break-all">{viewer.account.email}</dd>
              </div>
            </dl>
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
              {t("detailsNote")}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-8">
            <h2 className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-ink-faint">
              {t("needSomething")}
            </h2>
            <p className="text-[0.875rem] leading-relaxed text-ink-soft">
              {translate(business.tagline, language)}
            </p>
            <ExternalButtonLink
              href={whatsappLink(
                language === "es"
                  ? `Hola Daysi, soy ${viewer.account.name || viewer.account.email}.`
                  : `Hi Daysi, this is ${viewer.account.name || viewer.account.email}.`,
              )}
              tone="outline"
              size="small"
              className="w-fit"
            >
              WhatsApp
            </ExternalButtonLink>
          </div>
        </aside>
      </div>
    </>
  );
}
