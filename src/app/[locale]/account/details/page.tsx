import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { currentViewer } from "@/lib/auth/session";
import { cardForAccount } from "@/lib/client-cards";
import { PageHeader } from "@/components/page-header";
import { ClientCardForm, type CardFormInitial } from "@/components/client-card-form";

/**
 * The client's own card, filled in when they can. The form gets only what it
 * shows: never Daysi's private note, the card's id or the account's.
 */
export default async function AccountDetailsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;

  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);

  const t = await getTranslations("clientCard");
  const card = cardForAccount(viewer.account);
  const initial: CardFormInitial = {
    name: card?.name || viewer.account.name,
    email: viewer.account.email,
    phone: card?.phone ?? "",
    preferredContact: card?.preferredContact ?? null,
    address: card?.address ?? null,
    notes: card?.notes ?? "",
    measurements: card?.measurements ?? {},
  };

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <ClientCardForm initial={initial} locale={language} />
      </div>
    </>
  );
}
