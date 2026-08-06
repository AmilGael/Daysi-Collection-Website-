import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { services, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("services");
  const tn = await getTranslations("nav");

  return (
    <>
      <PageHeader eyebrow={tn("services")} title={t("title")} lead={t("lead")} />

      <div className="flex flex-col">
        {services.map((service, index) => (
          <section
            key={service.id}
            className={`reveal ${index % 2 === 1 ? "bg-paper-warm" : ""}`}
          >
            <div className="shell grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:gap-20">
              <div
                className={`relative aspect-4/3 overflow-hidden bg-paper-deep ${
                  index % 2 === 1 ? "lg:order-2" : ""
                }`}
              >
                <Image
                  src={service.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 45vw, 90vw"
                  className="object-cover"
                />
              </div>

              <div className="flex flex-col gap-6">
                <p className="eyebrow">{translate(service.promise, language)}</p>
                <h2 className="text-title">{translate(service.name, language)}</h2>
                <p className="max-w-xl leading-[1.75] text-ink-soft">
                  {translate(service.description, language)}
                </p>
                <div className="flex flex-col gap-3 border-t border-line pt-6">
                  <h3 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
                    {t("includes")}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {service.includes.map((item) => (
                      <li
                        key={item.en}
                        className="flex items-start gap-3 text-[0.9375rem] text-ink-soft"
                      >
                        <span
                          aria-hidden
                          className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-marigold"
                        />
                        {translate(item, language)}
                      </li>
                    ))}
                  </ul>
                </div>
                <ButtonLink href="/appointments" className="mt-2 w-fit">
                  {t("cta")}
                </ButtonLink>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
