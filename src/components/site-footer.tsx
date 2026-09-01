import { getTranslations, getLocale } from "next-intl/server";
import { business, translate } from "@/content";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { Logo } from "./logo";
import { LanguageSwitch } from "./language-switch";
import { whatsappLink } from "@/lib/whatsapp";

const EXPLORE = [
  { href: "/collection", label: "collection" },
  { href: "/premieres", label: "premieres" },
  { href: "/atelier", label: "atelier" },
  { href: "/design-studio", label: "studio" },
] as const;

const WORK = [
  { href: "/services", label: "services" },
  { href: "/alterations", label: "alterations" },
  { href: "/prices", label: "prices" },
  { href: "/appointments", label: "book" },
  { href: "/contact", label: "contact" },
] as const;

export async function SiteFooter() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  const socials = Object.entries(business.social).filter(
    (entry): entry is [string, string] => entry[1] !== null,
  );

  return (
    <footer className="on-ink mt-32 bg-ink text-paper">
      <div className="shell grid gap-14 py-20 md:grid-cols-[1.4fr_1fr_1fr] lg:gap-20">
        <div className="flex flex-col gap-6">
          <Logo tone="paper" className="text-paper" />
          <p className="max-w-sm text-sm leading-relaxed text-paper-faint">
            {t("footer.tagline")}
          </p>
          <div className="flex flex-col gap-1 text-sm text-paper-soft">
            {/* The link opens WhatsApp; the number itself is not printed. */}
            <a href={whatsappLink("Hola Daysi,")} className="link-underline w-fit">
              {t("common.whatsapp")}
            </a>
            <a href={`mailto:${business.email}`} className="link-underline w-fit">
              {business.email}
            </a>
            <span className="pt-2 text-paper-faint">{translate(business.serviceArea, locale)}</span>
          </div>
          <LanguageSwitch />
        </div>

        <FooterColumn title={t("footer.explore")}>
          {EXPLORE.map((item) => (
            <FooterLink key={item.href} href={item.href}>
              {t(`nav.${item.label}`)}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title={t("footer.work")}>
          {WORK.map((item) => (
            <FooterLink key={item.href} href={item.href}>
              {t(`nav.${item.label}`)}
            </FooterLink>
          ))}
        </FooterColumn>
      </div>

      <div className="shell flex flex-col gap-6 border-t border-paper/12 py-8 text-xs text-paper-faint sm:flex-row sm:items-center sm:justify-between">
        <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/terms" className="hover:text-paper">
            {t("footer.terms")}
          </Link>
          <Link href="/privacy" className="hover:text-paper">
            {t("footer.privacy")}
          </Link>
          {socials.map(([network, url]) => (
            <a
              key={network}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="capitalize hover:text-paper"
            >
              {network}
            </a>
          ))}
          <span className="text-paper-faint">{t("footer.built")}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-paper-faint">
        {title}
      </h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="w-fit text-sm text-paper-soft transition-colors hover:text-paper">
      {children}
    </Link>
  );
}
