import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatMoney } from "@/lib/money";
import { listRequests, storedKinds, type StoredRequest } from "@/lib/request-store";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/ui";

/**
 * Everything that has come in through the site, so the workflow can be checked
 * end to end while the site runs locally: submit a request, see it arrive.
 *
 * This is a development view. It is not linked from anywhere and it refuses to
 * render outside development, because it shows client contact details and has
 * no login in front of it. Before this page is useful in production it needs
 * real authentication, or the requests should be read from Daysi's email and
 * her content editor instead.
 */
export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("inbox");

  const kinds = await storedKinds();
  const records = (await Promise.all(kinds.map(listRequests)))
    .flat()
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <>
      <PageHeader eyebrow="Development" title={t("title")} lead={t("lead")} />

      <div className="shell pb-24">
        {records.length === 0 ? (
          <p className="border border-dashed border-line px-6 py-16 text-center text-ink-faint">
            {t("empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {records.map((record) => (
              <RequestRow key={`${record.reference}-${record.status}`} record={record} locale={language} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RequestRow({ record, locale }: { record: StoredRequest; locale: Locale }) {
  return (
    <article className="flex flex-col gap-4 border border-line p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tag tone="marigold">{record.kind}</Tag>
          <span className="font-mono text-[0.8125rem]">{record.reference}</span>
          <Tag>{record.status}</Tag>
        </div>
        <time className="text-[0.8125rem] text-ink-faint" dateTime={record.submittedAt}>
          {new Date(record.submittedAt).toLocaleString(locale === "es" ? "es-US" : "en-US")}
        </time>
      </header>

      <div className="grid gap-6 text-[0.875rem] sm:grid-cols-2">
        <dl className="flex flex-col gap-1">
          <Line label="Name" value={record.client.name} />
          <Line label="Email" value={record.client.email} />
          {record.client.phone ? <Line label="Phone" value={record.client.phone} /> : null}
          {record.client.preferredContact ? (
            <Line label="Reply via" value={record.client.preferredContact} />
          ) : null}
          <Line label="Language" value={record.locale} />
        </dl>

        <dl className="flex flex-col gap-1">
          {Object.entries(record.details).map(([key, value]) => (
            <Line key={key} label={key} value={Array.isArray(value) ? value.join(", ") : String(value)} />
          ))}
          {record.photoFile ? <Line label="Photo" value={record.photoFile} /> : null}
          {record.estimate ? (
            <>
              <Line label="Total" value={formatMoney(record.estimate.total, locale)} />
              <Line label="Due now" value={formatMoney(record.estimate.dueNow, locale)} />
            </>
          ) : null}
        </dl>
      </div>
    </article>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-faint">{label}:</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
