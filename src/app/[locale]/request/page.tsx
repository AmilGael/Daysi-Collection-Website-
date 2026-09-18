import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories } from "@/content";
import { liveAlterations, liveFabrics } from "@/lib/live-pricing";
import { PageHeader } from "@/components/page-header";
import { RequestForm } from "@/components/request-form";

type Kind = "alteration" | "commission";

/** A garment from the collection is bought through the cart, not requested here. */
const KINDS: readonly Kind[] = ["alteration", "commission"];

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const t = await getTranslations("request");

  const requested = first(query.kind);
  const locked = KINDS.includes(requested as Kind);
  const kind = locked ? (requested as Kind) : "alteration";
  const initialAlterationId = first(query.alteration);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <RequestForm
          initialKind={kind}
          lockedKind={locked ? kind : null}
          initialAlterationId={initialAlterationId}
          alterations={liveAlterations()}
          categories={categories}
          fabrics={liveFabrics()}
        />
      </div>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
