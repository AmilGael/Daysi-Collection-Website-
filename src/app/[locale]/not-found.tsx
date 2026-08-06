import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui";

export default async function NotFound() {
  const t = await getTranslations("errors");
  const tn = await getTranslations("nav");

  return (
    <div className="shell flex min-h-[65svh] items-center py-24">
      <div className="flex max-w-xl flex-col gap-7">
        <p className="eyebrow">404</p>
        <h1 className="text-title">{t("notFound")}</h1>
        <p className="text-lead text-ink-soft">{t("notFoundBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/collection">{tn("collection")}</ButtonLink>
          <ButtonLink href="/" tone="outline">
            {tn("home")}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
