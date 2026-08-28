import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSupportedLocale, routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import { currentViewer } from "@/lib/auth/session";
import { cartCount, readCart } from "@/lib/cart";
import "../globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The header reads the session and cart cookies, so every page is rendered per
 * request. That is the cost of a signed-in header, and it is the right trade:
 * a cached page would show one visitor another visitor's basket.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      languages: { es: "/es", en: "/en" },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      images: ["/images/real/hero.jpg"],
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  // Who is looking, and what is in their basket. Both are read here so the
  // header never renders "sign in" to somebody who already is.
  const [viewer, cart] = await Promise.all([currentViewer(), readCart()]);

  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[2px] focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-paper"
          >
            {locale === "es" ? "Ir al contenido" : "Skip to content"}
          </a>
          <SiteHeader
            viewer={
              viewer
                ? {
                    name: viewer.account.name,
                    email: viewer.account.email,
                    isOwner: viewer.role === "owner",
                  }
                : null
            }
            cartCount={cartCount(cart)}
          />
          <main id="main">{children}</main>
          <SiteFooter />
          <Reveal />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
