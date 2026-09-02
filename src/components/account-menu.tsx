"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";

/**
 * The account control in the top right: a cart with a count, and an initial
 * that opens the menu a signed-in person expects to find there.
 *
 * The viewer is resolved on the server and passed in, so the header never
 * flashes "sign in" at somebody who is already signed in.
 */
export function AccountMenu({
  viewer,
  cartCount,
}: {
  viewer: { name: string; email: string; isOwner: boolean } | null;
  cartCount: number;
}) {
  const t = useTranslations("account");
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIsOpen(false), [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setIsOpen(false);
    router.refresh();
  }

  /*
   * No boxes. These were two bordered squares in a row of four, and a box
   * around a glyph says "press me" as loudly as the booking button does while
   * doing a quarter of the work. They keep the 40px target a thumb needs and
   * state themselves in opacity, like the tabs. `currentColor` already
   * inverts with the header.
   *
   * The account is the one exception, and it is a circle rather than a box:
   * the owner asked for it to read at a glance as a different kind of thing
   * from the cart beside it and the booking button after it. A thin ring in
   * the chrome's own colour does that without competing with the button.
   */
  const glyph =
    "flex h-10 w-10 items-center justify-center opacity-70 transition-opacity hover:opacity-100";
  const ring =
    "flex h-8 w-8 items-center justify-center rounded-full border border-current/60";

  return (
    <div className="flex items-center">
      <Link
        href="/cart"
        aria-label={t("cart")}
        className={`relative ${glyph}`}
      >
        <CartGlyph />
        {cartCount > 0 ? (
          <span className="absolute right-0 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-[2px] bg-marigold px-1 text-[0.625rem] font-medium tabular-nums text-ink">
            {cartCount}
          </span>
        ) : null}
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={viewer ? t("yourAccount") : t("signIn")}
          className={`${glyph} text-[0.75rem] font-medium uppercase`}
        >
          <span className={ring}>{viewer ? initialOf(viewer) : <PersonGlyph />}</span>
        </button>

        {isOpen ? (
          <div
            role="menu"
            className="surface-in--corner absolute right-0 top-12 z-50 w-60 border border-line bg-paper text-ink shadow-[0_18px_40px_-24px_rgba(20,17,13,0.5)]"
          >
            {viewer ? (
              <>
                <div className="border-b border-line px-4 py-3">
                  <p className="truncate text-[0.875rem] font-medium">
                    {viewer.name || t("yourAccount")}
                  </p>
                  <p className="truncate text-[0.75rem] text-ink-faint">{viewer.email}</p>
                </div>
                {viewer.isOwner ? (
                  <MenuLink href="/office">{t("office")}</MenuLink>
                ) : null}
                <MenuLink href="/account">{t("yourAccount")}</MenuLink>
                <MenuLink href="/account/orders">{t("orders")}</MenuLink>
                <MenuLink href="/cart">{t("cart")}</MenuLink>
                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  className="w-full border-t border-line px-4 py-3 text-left text-[0.875rem] text-ink-faint transition-colors hover:bg-paper-warm hover:text-ink"
                >
                  {t("signOut")}
                </button>
              </>
            ) : (
              <>
                <div className="border-b border-line px-4 py-3">
                  <p className="text-[0.875rem] font-medium">{t("signIn")}</p>
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-faint">
                    {t("signInBlurb")}
                  </p>
                </div>
                <MenuLink href="/sign-in">{t("signIn")}</MenuLink>
                <MenuLink href="/cart">{t("cart")}</MenuLink>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="block px-4 py-3 text-[0.875rem] transition-colors hover:bg-paper-warm"
    >
      {children}
    </Link>
  );
}

/** The first letter of a name, or of the address when there is no name yet. */
function initialOf(viewer: { name: string; email: string }): string {
  const source = viewer.name.trim() || viewer.email;
  return source.charAt(0).toUpperCase();
}

function CartGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M3 4h2l1.6 8.4a1 1 0 0 0 1 .8h6.5a1 1 0 0 0 1-.78L16.5 7H6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="16" r="1.1" fill="currentColor" />
      <circle cx="14" cy="16" r="1.1" fill="currentColor" />
    </svg>
  );
}

function PersonGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="10" cy="6.5" r="3.1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4 16.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
