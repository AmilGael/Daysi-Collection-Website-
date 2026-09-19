import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { clientBook } from "@/lib/client-book";
import { undoableIds } from "@/lib/office-history";
import { ClientBookView } from "@/components/client-book-view";
import type { OfficeBookRow } from "@/components/office/client-draft";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyClientChanges } from "./actions";

/**
 * Clientes: everyone Daysi has sewn for or sold to, worked out from their
 * cards, their accounts and every order, with one sheet per client for the
 * card she keeps on them.
 *
 * Owner-only, so a card's address and Daysi's own note may travel to the
 * browser here; the account id behind a card and who wrote it last may not,
 * since nothing on the page shows them.
 */
export default async function OfficeClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");
  const undoable = undoableIds("client-card");
  const rows: OfficeBookRow[] = clientBook().map(({ card, ...row }) => {
    if (!card) return row;
    const { accountId: _accountId, updatedBy: _updatedBy, ...shown } = card;
    return { ...row, card: shown };
  });
  const active = rows.filter((row) => !row.archived).length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-baseline gap-3 text-heading">
          {t("clientsTitle")}
          <span className="font-body text-[1rem] tabular-nums text-ink-faint">{active}</span>
        </h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">{t("clientsLead")}</p>
      </div>
      <OfficeDraftProvider apply={applyClientChanges}>
        <ClientBookView
          rows={rows}
          undoable={rows.flatMap((row) => (row.cardId && undoable.has(row.cardId) ? [row.cardId] : []))}
          locale={language}
        />
      </OfficeDraftProvider>
    </section>
  );
}
