import { getTranslations, setRequestLocale } from "next-intl/server";
import { categories } from "@/content";
import { liveAlterations, liveFabrics, livePriceList } from "@/lib/live-pricing";
import { requestPrefill } from "@/lib/estimate-handoff";
import { currentViewer } from "@/lib/auth/session";
import { knownContact } from "@/lib/client-cards";
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
  // What the estimate builder or an alteration card chose, checked against
  // what the shop offers today; see lib/estimate-handoff.ts.
  const alterations = liveAlterations();
  const fabrics = liveFabrics();
  const priceList = livePriceList();
  const viewer = await currentViewer();
  const contact = viewer ? knownContact(viewer.account) : null;
  const prefill = requestPrefill(query, {
    categoryIds: categories.map((category) => category.id),
    fabricIds: fabrics.map((fabric) => fabric.id),
    alterationIds: alterations.map((alteration) => alteration.id),
    priced: (categoryId, fabricId) =>
      priceList.some((entry) => entry.categoryId === categoryId && entry.fabricId === fabricId),
  });

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <RequestForm
          key={locked ? kind : "open"}
          initialKind={kind}
          lockedKind={locked ? kind : null}
          prefill={prefill}
          alterations={alterations}
          categories={categories}
          fabrics={fabrics}
          priceList={priceList}
          contact={contact}
        />
      </div>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
