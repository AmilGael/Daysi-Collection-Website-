import { getTranslations, setRequestLocale } from "next-intl/server";
import { business } from "@/content";
import { PageHeader } from "@/components/page-header";

const SECTIONS = ["collect", "use", "keep", "rights", "cookies"] as const;

const LAST_UPDATED = "2026-08-06";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  const updated = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(LAST_UPDATED));

  return (
    <>
      <PageHeader eyebrow={t("updated", { date: updated })} title={t("title")} lead={t("intro")} />

      <div className="shell pb-24">
        <div className="flex max-w-2xl flex-col">
          {SECTIONS.map((section) => (
            <section key={section} className="border-t border-line py-8">
              <h2 className="text-heading">{t(section)}</h2>
              <p className="mt-3 leading-[1.8] text-ink-soft">
                {t(`${section}Body`, { email: business.email })}
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
