import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

/**
 * Both languages are first-class: every route exists in English and Spanish and
 * carries the same content (PRD quality need #2). Spanish is the default because
 * it is the language Daysi and most of her Bronx clients speak.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "always",
  localeDetection: true,
  // next-intl 4 remembers a chosen language only for the browser session. A
  // client who picked English should still land on English next month, which
  // is what version 3 did, so the cookie keeps its year.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];

export function isSupportedLocale(value: string | undefined): value is Locale {
  return value !== undefined && (routing.locales as readonly string[]).includes(value);
}

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
