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
});

export type Locale = (typeof routing.locales)[number];

export function isSupportedLocale(value: string | undefined): value is Locale {
  return value !== undefined && (routing.locales as readonly string[]).includes(value);
}

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
