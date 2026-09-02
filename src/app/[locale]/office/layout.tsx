import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { OfficeTabs } from "@/components/office/office-tabs";
import { officeViewer } from "./_lib/viewer";

/**
 * Daysi's office: the heading, the tabs, and the guard on the door.
 *
 * Every tab under here shares this shell. The guard runs here for the shell
 * and again in each page; see `_lib/viewer.ts` for why both.
 */
export default async function OfficeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await officeViewer(locale);
  const t = await getTranslations("office");

  return (
    <>
      <PageHeader title={t("title", { name: viewer.account.name || "Daysi" })} lead={t("lead")}>
        <OfficeTabs />
      </PageHeader>

      <div className="shell flex flex-col gap-16 pb-28">{children}</div>
    </>
  );
}
