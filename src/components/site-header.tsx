"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Logo } from "./logo";
import { LanguageSwitch } from "./language-switch";
import { buttonClass } from "./ui";

/**
 * The site's tabs. Seven destinations plus the one action the whole site is
 * pointing at, which stays visible at every width.
 */
const TABS = [
  { href: "/collection", label: "collection" },
  { href: "/premieres", label: "premieres" },
  { href: "/services", label: "services" },
  { href: "/alterations", label: "alterations" },
  { href: "/prices", label: "prices" },
  { href: "/design-studio", label: "studio" },
  { href: "/atelier", label: "atelier" },
] as const;

/**
 * Pages that open with a full-bleed dark photograph behind the header. On these
 * the header starts light and inverts to the normal light-background chrome as
 * soon as the page scrolls past the image.
 */
const DARK_HERO_ROUTES = ["/", "/premieres", "/atelier"];

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A route change closes the menu; leaving it open over new content is jarring.
  useEffect(() => setIsMenuOpen(false), [pathname]);

  // The page behind an open full-screen menu should not scroll.
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const isOverPhotograph =
    DARK_HERO_ROUTES.includes(pathname) && !isScrolled && !isMenuOpen;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
        isOverPhotograph
          ? "border-b border-transparent bg-transparent text-paper"
          : "border-b border-line bg-paper/92 text-ink backdrop-blur-md"
      }`}
    >
      <div className="shell flex h-20 items-center justify-between gap-6">
        <Link href="/" aria-label="Daysi Collection">
          <Logo />
        </Link>

        <nav aria-label={t("home")} className="hidden items-center gap-7 xl:flex">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative text-[0.6875rem] font-medium uppercase tracking-[0.18em] transition-colors ${
                  isActive ? "opacity-100" : "opacity-70 hover:opacity-100"
                }`}
              >
                {t(tab.label)}
                <span
                  aria-hidden
                  className={`absolute -bottom-2 left-0 h-px bg-marigold transition-all duration-300 ${
                    isActive ? "w-full" : "w-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <LanguageSwitch tone={isOverPhotograph ? "paper" : "ink"} />
          </div>
          <Link
            href="/appointments"
            className={buttonClass({
              size: "small",
              tone: isOverPhotograph ? "marigold" : "solid",
              className: "whitespace-nowrap",
            })}
          >
            {/* The full label needs room a phone header does not have. */}
            <span className="hidden sm:inline">{t("bookCta")}</span>
            <span className="sm:hidden">{t("bookCtaShort")}</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? t("closeMenu") : t("openMenu")}
            className={`flex h-10 w-10 items-center justify-center rounded-full border xl:hidden ${
              isOverPhotograph ? "border-paper/40" : "border-line"
            }`}
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute left-0 h-px w-full bg-current transition-all duration-300 ${
                  isMenuOpen ? "top-1.5 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 h-px w-full bg-current transition-all duration-300 ${
                  isMenuOpen ? "top-1.5 -rotate-45" : "top-3"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-x-0 top-20 bottom-0 z-40 overflow-y-auto bg-paper xl:hidden">
          <nav className="shell flex flex-col gap-1 py-8">
            {TABS.map((tab, index) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="border-b border-line py-5 font-display text-[1.75rem] text-ink"
                style={{ animation: `menuIn 0.4s ${index * 0.04}s both` }}
              >
                {t(tab.label)}
              </Link>
            ))}
            <Link href="/contact" className="border-b border-line py-5 font-display text-[1.75rem]">
              {t("contact")}
            </Link>
            <div className="pt-8 sm:hidden">
              <LanguageSwitch />
            </div>
          </nav>
          <style>{`@keyframes menuIn { from { opacity: 0; transform: translateY(0.75rem) } to { opacity: 1; transform: none } }`}</style>
        </div>
      ) : null}
    </header>
  );
}
