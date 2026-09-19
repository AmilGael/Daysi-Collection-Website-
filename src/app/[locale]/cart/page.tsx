import { getTranslations, setRequestLocale } from "next-intl/server";
import { liveStyles } from "@/lib/live-catalog";
import { readCart } from "@/lib/cart";
import { estimateCart } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/env";
import { currentViewer } from "@/lib/auth/session";
import { knownContact } from "@/lib/client-cards";
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
  const contact = viewer ? knownContact(viewer.account) : null;

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <div className="shell pb-28">
        <CartView
          initialCart={cart}
          initialEstimate={estimate}
          styles={liveStyles()}
          viewer={
            viewer && contact
              ? { name: contact.name, email: viewer.account.email, phone: contact.phone }
              : null
          }
          paymentsEnabled={paymentsEnabled}
        />
      </div>
    </>
  );
}
