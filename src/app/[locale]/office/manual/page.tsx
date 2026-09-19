import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { manualSheet, readManual } from "@/lib/manual";
import { officeViewer } from "../_lib/viewer";

/**
 * The manual Daysi was handed, shown inside her office rather than as a
 * separate page in a new tab: the site header and the office tabs stay
 * where they are, and the `.manual` rules in `globals.css` set it in the
 * site's own Fraunces and Inter. It is not a tab of its own (see
 * `tabs.test.ts`); "Abrir el manual" is the way in.
 *
 * It writes nothing, so it needs no draft provider. The manual is written
 * in Spanish only, whichever language the office is in, hence `lang`.
 */
export default async function OfficeManualPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await officeViewer(locale);

  const html = readManual();
  const sheet = html ? manualSheet(html) : null;
  if (!sheet) notFound();

  // The markup is our own file from the repo, read on the server, and never
  // anything a visitor typed, which is what makes setting it as HTML safe.
  return <article className="manual" lang="es" dangerouslySetInnerHTML={{ __html: sheet }} />;
}
