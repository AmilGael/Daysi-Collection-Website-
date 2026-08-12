import { getTranslations, setRequestLocale } from "next-intl/server";
import { publishedStyles } from "@/content";
import { readCart } from "@/lib/cart";
import { estimateCart } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/env";
import { currentViewer } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { CartView } from "@/components/cart-view";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cart");

  const [cart, viewer] = await Promise.all([readCart(), currentViewer()]);
  const estimate = estimateCart(cart.lines);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <CartView
          initialCart={cart}
          initialEstimate={estimate}
          styles={publishedStyles()}
          viewer={
            viewer ? { name: viewer.account.name, email: viewer.account.email } : null
          }
          paymentsEnabled={paymentsEnabled}
        />
      </div>
    </>
  );
}
