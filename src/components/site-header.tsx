"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { BAR_TABS, NAV_TABS } from "@/content/navigation";
import { OFFICE_TABS } from "./office/tabs";
import { OfficeTabs } from "./office/office-tabs";
import { Logo } from "./logo";
import { LanguageSwitch } from "./language-switch";
import { AccountMenu } from "./account-menu";
import { buttonClass } from "./ui";

export type HeaderViewer = { name: string; email: string; isOwner: boolean } | null;

/**
 * Pages that open with a full-bleed dark photograph behind the header. On these
 * the header starts light and inverts to the normal light-background chrome as
 * soon as the page scrolls past the image.
 */
const DARK_HERO_ROUTES = ["/", "/premieres", "/atelier"];

export function SiteHeader({
  viewer,
  cartCount,
}: {
  viewer: HeaderViewer;
  cartCount: number;
}) {
  const t = useTranslations("nav");
  const to = useTranslations("office");
  const pathname = usePathname();

  // Inside the office the bar belongs to the office: its eight tabs take the
  // place of the store links, and the store is one tap away through the
  // menu. Office tabs match exactly, because `/office` prefixes every other
  // one; store links match by prefix, because a garment page is still the
  // collection.
  const inOffice =
    Boolean(viewer?.isOwner) && (pathname === "/office" || pathname.startsWith("/office/"));
  const barTabs = inOffice
    ? OFFICE_TABS.map((tab) => ({ href: tab.href, label: to(tab.labelKey), exact: true }))
    : BAR_TABS.map((tab) => ({ href: tab.href, label: t(tab.label), exact: false }));
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

  // The bar reads as three sections — the logo, the tabs, the controls — and
  // a full-height hairline between each keeps the tabs from crowding the
  // logo. The line takes the chrome's own colour at a whisper: `line` on
  // paper, translucent paper over a photograph.
  const dividerClass = isOverPhotograph ? "border-paper/30" : "border-line";

  return (
    <>
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,color] duration-300 ${
        isOverPhotograph
          ? "on-ink relative border-b border-transparent bg-transparent text-paper"
          : "border-b border-line bg-paper/92 text-ink backdrop-blur-md"
      }`}
    >
      {/*
        Light chrome over a photograph is only legible if the photograph is
        dark where the chrome is, and these are real photographs rather than
        a designed backdrop: the premiere cover is a white-and-red print and
        the tabs measured about 1.4:1 across it.

        A band rather than a full-frame overlay, and only on the pages that
        put a photograph up here. It is 8rem so the fade finishes below the
        80px bar, which means the type sits in the dense part and the picture
        is untouched from the fold down.

        Tuned against the render rather than by eye, which is the only way to
        know: measured on the composited page with the bar's own type hidden,
        the worst control on the worst of the three pages reads 5.3:1, and
        every other one is between 7 and 14. It started at /85, which bought
        14.8:1 where 4.5 was the requirement and threw away a photograph for
        nothing.
      */}
      {isOverPhotograph ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/78 via-ink/48 to-transparent"
        />
      ) : null}

      <div className="shell relative flex h-20 items-center justify-between gap-4 2xl:gap-6">
        <Link href="/" aria-label="Daysi Collection">
          <Logo tone={isOverPhotograph ? "paper" : "ink"} />
        </Link>

        <nav
          aria-label={t("home")}
          className={`hidden items-center gap-3 self-stretch min-[75rem]:flex min-[75rem]:border-l min-[75rem]:pl-6 2xl:gap-5 ${dividerClass}`}
        >
          {barTabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative whitespace-nowrap text-[0.6875rem] font-medium uppercase tracking-[0.18em] transition-colors ${
                  isActive ? "opacity-100" : "opacity-70 hover:opacity-100"
                }`}
              >
                {tab.label}
                <span
                  aria-hidden
                  /* Scales rather than grows: width is a layout property and
                     animating it relays the line every frame. */
                  className={`absolute -bottom-2 left-0 h-px w-full origin-left bg-marigold transition-transform duration-300 ${
                    isActive ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/*
          The corner used to hold four bordered boxes and a button: a boxed
          language toggle, a boxed cart, a boxed account initial, the booking
          call to action, and a boxed menu control — 435px of chrome in
          Spanish, most of it drawn rectangles competing with each other and
          with the marigold button that is the only thing here anyone is meant
          to press.

          The boxes are gone. The glyphs keep their 40px target and state
          themselves in opacity, the way the tabs do, so the button is the one
          filled shape in the corner and reads as the one action. That returned
          about 120px, which is what paid for the seventh tab in the bar.
        */}
        <div className={`flex items-center gap-2 self-stretch border-l pl-3 sm:gap-3 sm:pl-4 ${dividerClass}`}>
          <div className="hidden sm:block">
            <LanguageSwitch />
          </div>
          <AccountMenu viewer={viewer} cartCount={cartCount} />
          {/*
            The responsive switch sits on a wrapper rather than on the button.
            buttonClass begins with `inline-flex`, so a `hidden` handed to it
            through className is two display utilities of equal weight fighting
            in the same layer — and `hidden` was losing, which put both labels
            in the bar at once and pushed it 200px past the screen on a phone.

            The short label serves two windows: a phone, and 1200–1280px,
            where the tab bar has just arrived and the full label is the 72px
            that would push it back off the screen.
          */}
          <span className="hidden sm:contents min-[75rem]:hidden xl:contents">
            <BookingLink label={t("bookCta")} onPhotograph={isOverPhotograph} />
          </span>
          <span className="contents sm:hidden min-[75rem]:contents xl:hidden">
            <BookingLink label={t("bookCtaShort")} onPhotograph={isOverPhotograph} />
          </span>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="site-menu"
            aria-label={isMenuOpen ? t("closeMenu") : t("openMenu")}
            className="flex h-10 w-10 items-center justify-center opacity-70 transition-[opacity,transform] hover:opacity-100 active:scale-[0.97]"
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute left-0 top-0 h-px w-full bg-current transition-transform duration-300 ${
                  isMenuOpen ? "translate-y-1.5 rotate-45" : "translate-y-0"
                }`}
              />
              <span
                className={`absolute left-0 top-0 h-px w-full bg-current transition-transform duration-300 ${
                  isMenuOpen ? "translate-y-1.5 -rotate-45" : "translate-y-3"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {inOffice ? (
        // Below the bar's breakpoint the office tabs get a row of their own,
        // scrolling sideways, where the store links would have been hidden in
        // the menu. One row of tabs, either way.
        <div className="shell min-[75rem]:hidden">
          <OfficeTabs />
        </div>
      ) : null}
    </header>

    {/*
      The panel is a sibling of the header, not a child, and that placement is
      load-bearing. The scrolled header wears `backdrop-blur-md`, and an
      ancestor with a backdrop-filter becomes the containing block for fixed
      descendants — inside the 80px header, `top-20 bottom-0` resolves to a
      zero-height strip and the menu opens into nothing. Opening the menu
      forces the blurred variant (isOverPhotograph is false while it is open),
      so as a child this panel could never be seen at all.
    */}
    {isMenuOpen ? (
      <div
        id="site-menu"
        className="fixed inset-x-0 top-20 bottom-0 z-30 overflow-y-auto bg-paper text-ink"
      >
        <nav className="shell flex flex-col gap-1 py-8">
          {NAV_TABS.map((tab, index) => (
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
    </>
  );
}

/**
 * The one filled shape in the corner, and the only thing there anyone is meant
 * to press. Two calls rather than one because the label changes with the width
 * and the wrapper, not the button, carries the switch; see the note above.
 */
function BookingLink({ label, onPhotograph }: { label: string; onPhotograph: boolean }) {
  return (
    <Link
      href="/appointments"
      className={buttonClass({
        size: "small",
        tone: onPhotograph ? "marigold" : "solid",
        className: "whitespace-nowrap",
      })}
    >
      {label}
    </Link>
  );
}
