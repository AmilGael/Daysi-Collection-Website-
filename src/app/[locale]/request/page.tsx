import { getTranslations, setRequestLocale } from "next-intl/server";
import { alterationServices, categories, fabrics, publishedStyles } from "@/content";
import { PageHeader } from "@/components/page-header";
import { RequestForm } from "@/components/request-form";

type Kind = "alteration" | "order" | "commission";

const KINDS: readonly Kind[] = ["alteration", "order", "commission"];

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
  const kind = KINDS.includes(requested as Kind) ? (requested as Kind) : "alteration";

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <RequestForm
          initialKind={kind}
          initialStyleSlug={first(query.style)}
          initialSizeId={first(query.size)}
          initialCustomize={first(query.customize) === "1"}
          styles={publishedStyles()}
          alterations={alterationServices}
          categories={categories}
          fabrics={fabrics}
        />
      </div>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
