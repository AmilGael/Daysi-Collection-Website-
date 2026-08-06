import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { services, translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui";

/**
 * The three services, each given a band of its own.
 *
 * They alternate side to side the way Alts' "Our Craft" section does, but which
 * side is a property of the service rather than the parity of a loop index, and
 * the columns are 7/4 rather than split down the middle — an even split is the
 * layout you get when nobody chose one.
 */
const LAYOUT = {
  custom: { imageFirst: true, aspect: "aspect-4/5" },
  alterations: { imageFirst: false, aspect: "aspect-4/3" },
  "ready-made": { imageFirst: true, aspect: "aspect-4/3" },
} as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  const t = await getTranslations("services");

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <div className="flex flex-col">
        {services.map((service, index) => {
          const layout = LAYOUT[service.id as keyof typeof LAYOUT];
          return (
            <section
              key={service.id}
              className={`reveal border-t border-line ${index === 1 ? "bg-paper-warm" : ""}`}
            >
              <div className="shell grid gap-10 py-20 lg:grid-cols-12 lg:gap-16 lg:py-28">
                <div
                  className={`relative ${layout.aspect} overflow-hidden bg-paper-deep lg:col-span-7 ${
                    layout.imageFirst ? "" : "lg:order-2 lg:col-start-6"
                  }`}
                >
                  <Image
                    src={service.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 55vw, 90vw"
                    className="object-cover"
                  />
                </div>

                <div
                  className={`flex flex-col gap-6 lg:col-span-4 lg:justify-center ${
                    layout.imageFirst ? "lg:col-start-9" : "lg:order-1 lg:col-start-1"
                  }`}
                >
                  <span className="font-display text-[0.9375rem] tabular-nums text-ink-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-title text-balance">{translate(service.name, language)}</h2>
                  <p className="text-lead text-ink-soft">
                    {translate(service.promise, language)}
                  </p>
                  <p className="leading-[1.8] text-ink-soft">
                    {translate(service.description, language)}
                  </p>

                  <ul className="mt-2 flex flex-col border-t border-line">
                    {service.includes.map((item) => (
                      <li
                        key={item.en}
                        className="border-b border-line py-3 text-[0.9375rem] text-ink-soft"
                      >
                        {translate(item, language)}
                      </li>
                    ))}
                  </ul>

                  <ButtonLink href="/appointments" className="mt-2 w-fit">
                    {t("cta")}
                  </ButtonLink>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
